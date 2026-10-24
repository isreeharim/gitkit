import {
  GitHubClient,
  GitHubApiError,
  type IGitHubClient,
  type RawGitHubRepository,
  type RawGitHubTree,
  type RawGitHubTreeEntry,
} from './client';
import type {
  RepositoryMetadata,
  RepositoryTree,
  RepositoryTreeEntry,
  TreeEntryType,
  RepositoryIngestionResult,
  RepositoryLicense,
} from '@/types/repository';
import type { DependencyGraph, ImportStatement, PackageDependency } from '@/types/dependency';
import {
  isSupportedSourceFile,
  isManifestFile,
  parseManifest,
  parseSourceImports,
} from '@/lib/parser';
import { buildDependencyGraph } from '@/lib/analyzer';
import {
  buildRepositoryMetricsReport,
  countLinesOfCode,
  isSourceCodeFile,
  isGeneratedOrVendor,
} from '@/lib/metrics';
import type { RepositoryMetricsReport, LocAnalysisResult, ActivityMetrics } from '@/types/metrics';
import type { GitHistoryAnalysisReport } from '@/types/git';
import { GitHubGitProvider, GitService, type GitQueryOptions } from '@/lib/git';
import type { PullRequestSummary, PullRequestImpactReport } from '@/types/pull-request';
import { PullRequestService } from '@/lib/pulls';
import type { RepositoryHealthReport } from '@/types/health';
import { evaluateRepositoryHealth } from '@/lib/analyzer/health';

/**
 * Deterministically normalizes a raw GitHub repository API payload
 * into GitKit's internal RepositoryMetadata model.
 */
export function normalizeRepositoryMetadata(raw: RawGitHubRepository): RepositoryMetadata {
  const license: RepositoryLicense | null = raw.license
    ? {
        key: raw.license.key,
        name: raw.license.name,
        spdxId: raw.license.spdx_id,
        url: raw.license.url,
      }
    : null;

  const visibility = raw.private
    ? 'private'
    : raw.visibility === 'internal'
      ? 'internal'
      : 'public';

  return {
    owner: raw.owner.login,
    name: raw.name,
    fullName: raw.full_name,
    description: raw.description ?? null,
    htmlUrl: raw.html_url,
    defaultBranch: raw.default_branch || 'main',
    visibility,
    isFork: Boolean(raw.fork),
    isArchived: Boolean(raw.archived),
    stars: raw.stargazers_count ?? 0,
    forks: raw.forks_count ?? 0,
    openIssues: raw.open_issues_count ?? 0,
    watchers: raw.watchers_count ?? 0,
    license,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pushedAt: raw.pushed_at,
    language: raw.language ?? null,
    topics: Array.isArray(raw.topics) ? raw.topics : [],
    homepage: raw.homepage ?? null,
    sizeKb: raw.size ?? 0,
  };
}

/**
 * Normalizes a raw tree entry object.
 */
function normalizeTreeEntry(entry: RawGitHubTreeEntry): RepositoryTreeEntry {
  const path = entry.path || '';
  const name = path.split('/').pop() || path;

  let type: TreeEntryType = 'other';
  if (entry.type === 'blob') {
    type = 'blob';
  } else if (entry.type === 'tree') {
    type = 'tree';
  } else if (entry.type === 'commit') {
    type = 'submodule';
  }

  return {
    path,
    name,
    type,
    size: entry.size,
    sha: entry.sha || '',
    mode: entry.mode || '',
  };
}

/**
 * Deterministically normalizes raw GitHub Git tree payload into GitKit's RepositoryTree model.
 */
export function normalizeRepositoryTree(raw: RawGitHubTree): RepositoryTree {
  const rawList = Array.isArray(raw.tree) ? raw.tree : [];
  let totalFiles = 0;
  let totalDirectories = 0;
  let totalBytes = 0;

  const entries: RepositoryTreeEntry[] = [];

  for (const item of rawList) {
    if (!item.path) continue;

    const normalized = normalizeTreeEntry(item);
    entries.push(normalized);

    if (normalized.type === 'blob') {
      totalFiles++;
      if (typeof normalized.size === 'number') {
        totalBytes += normalized.size;
      }
    } else if (normalized.type === 'tree') {
      totalDirectories++;
    }
  }

  // Sort deterministically: directories first, then alphabetical by path
  entries.sort((a, b) => {
    if (a.type === 'tree' && b.type !== 'tree') return -1;
    if (a.type !== 'tree' && b.type === 'tree') return 1;
    return a.path.localeCompare(b.path);
  });

  return {
    sha: raw.sha,
    truncated: Boolean(raw.truncated),
    entries,
    totalFiles,
    totalDirectories,
    totalBytes,
  };
}

/**
 * Service encapsulating GitHub repository ingestion workflows.
 */
export class RepositoryService {
  constructor(private readonly client: IGitHubClient = new GitHubClient()) {}

  /**
   * Ingests a public repository: metadata and recursive file tree.
   */
  async ingestRepository(owner: string, repo: string): Promise<RepositoryIngestionResult> {
    try {
      // 1. Fetch metadata
      const rawRepo = await this.client.fetchRepository(owner, repo);

      // Verify repository is public
      if (rawRepo.private) {
        return {
          success: false,
          error: {
            kind: 'unauthorized',
            message: `Repository "${owner}/${repo}" is private. GitKit currently only inspects public repositories.`,
            status: 403,
          },
        };
      }

      const metadata = normalizeRepositoryMetadata(rawRepo);

      // 2. Fetch recursive Git tree using default branch
      let tree: RepositoryTree;
      try {
        const rawTree = await this.client.fetchTree(owner, repo, metadata.defaultBranch);
        tree = normalizeRepositoryTree(rawTree);
      } catch (treeErr: unknown) {
        // If repository is empty (has no commits), GitHub returns 404 or 409
        if (
          treeErr instanceof GitHubApiError &&
          (treeErr.status === 404 || treeErr.status === 409)
        ) {
          tree = {
            sha: '',
            truncated: false,
            entries: [],
            totalFiles: 0,
            totalDirectories: 0,
            totalBytes: 0,
          };
        } else {
          throw treeErr;
        }
      }

      return {
        success: true,
        metadata,
        tree,
      };
    } catch (err: unknown) {
      if (err instanceof GitHubApiError) {
        return {
          success: false,
          error: {
            kind: err.kind,
            message: err.message,
            status: err.status,
            rateLimitReset: err.rateLimitReset,
          },
        };
      }

      const fallbackMsg =
        err instanceof Error ? err.message : 'Unknown repository ingestion failure';
      return {
        success: false,
        error: {
          kind: 'unknown',
          message: fallbackMsg,
        },
      };
    }
  }

  /**
   * Performs deterministic dependency analysis across manifests and prioritized source files.
   */
  async analyzeDependencies(
    owner: string,
    repo: string,
    tree: RepositoryTree,
    maxSourceFilesToFetch = 30
  ): Promise<DependencyGraph> {
    const allRepoPaths = new Set(tree.entries.map((e) => e.path));
    const manifests: PackageDependency[] = [];
    const parsedFiles = new Map<string, ImportStatement[]>();

    // 1. Discover and parse manifests
    const manifestEntries = tree.entries.filter((e) => e.type === 'blob' && isManifestFile(e.path));

    for (const manifestEntry of manifestEntries) {
      const content = await this.client.fetchBlobContent(owner, repo, manifestEntry.sha);
      if (content) {
        const parsed = parseManifest(manifestEntry.path, content);
        manifests.push(...parsed);
      }
    }

    // 2. Discover supported source files
    const sourceEntries = tree.entries.filter(
      (e) => e.type === 'blob' && isSupportedSourceFile(e.path)
    );

    // Prioritize root and primary source files (e.g. entry points and shallow paths)
    sourceEntries.sort((a, b) => {
      const isEntryA = /^(src\/)?(index|main|app|server)\.[a-z]+$/i.test(a.path);
      const isEntryB = /^(src\/)?(index|main|app|server)\.[a-z]+$/i.test(b.path);
      if (isEntryA && !isEntryB) return -1;
      if (!isEntryA && isEntryB) return 1;
      return a.path.length - b.path.length;
    });

    const entriesToFetch = sourceEntries.slice(0, maxSourceFilesToFetch);

    // Fetch and parse prioritized source files
    await Promise.all(
      entriesToFetch.map(async (entry) => {
        try {
          const content = await this.client.fetchBlobContent(owner, repo, entry.sha);
          if (content) {
            const imports = parseSourceImports(entry.path, content);
            parsedFiles.set(entry.path, imports);
          }
        } catch {
          // Graceful fallback: continue analyzing remaining files
        }
      })
    );

    // 3. Construct deterministic DependencyGraph
    return buildDependencyGraph({
      parsedFiles,
      allRepoPaths,
      manifests,
    });
  }

  /**
   * Deterministically calculates comprehensive repository metrics report.
   */
  async calculateMetrics(
    owner: string,
    repo: string,
    metadata: RepositoryMetadata,
    tree: RepositoryTree,
    maxSourceFilesForLoc = 20
  ): Promise<RepositoryMetricsReport> {
    // 1. Fetch activity metrics concurrently (commit and contributor counts)
    let commitCount: number | null = null;
    let contributorCount: number | null = null;

    try {
      const [commits, contributors] = await Promise.all([
        this.client.fetchCommitCount ? this.client.fetchCommitCount(owner, repo) : null,
        this.client.fetchContributorCount ? this.client.fetchContributorCount(owner, repo) : null,
      ]);
      commitCount = commits;
      contributorCount = contributors;
    } catch {
      // Graceful fallback: metrics remain null/unavailable without failing ingestion
    }

    const activity: ActivityMetrics = {
      commitCount,
      contributorCount,
      isCommitCountApproximate: false,
      isContributorCountApproximate: false,
    };

    // 2. Sample prioritized source files for LOC, blank, and comment counting
    const candidateFiles = tree.entries.filter(
      (e) => e.type === 'blob' && isSourceCodeFile(e.path) && !isGeneratedOrVendor(e.path)
    );

    // Prioritize entry points and primary modules
    candidateFiles.sort((a, b) => {
      const isEntryA = /^(src\/)?(index|main|app|server)\.[a-z]+$/i.test(a.path);
      const isEntryB = /^(src\/)?(index|main|app|server)\.[a-z]+$/i.test(b.path);
      if (isEntryA && !isEntryB) return -1;
      if (!isEntryA && isEntryB) return 1;
      return a.path.length - b.path.length;
    });

    const sampledEntries = candidateFiles.slice(0, maxSourceFilesForLoc);

    let totalLines = 0;
    let codeLines = 0;
    let commentLines = 0;
    let blankLines = 0;
    let analyzedFilesCount = 0;

    await Promise.all(
      sampledEntries.map(async (entry) => {
        try {
          const content = await this.client.fetchBlobContent(owner, repo, entry.sha);
          if (content !== null) {
            const counts = countLinesOfCode(content, entry.path);
            totalLines += counts.totalLines;
            codeLines += counts.codeLines;
            commentLines += counts.commentLines;
            blankLines += counts.blankLines;
            analyzedFilesCount++;
          }
        } catch {
          // Gracefully skip unreadable blobs
        }
      })
    );

    const isSampled = candidateFiles.length > analyzedFilesCount;
    const samplingNote = isSampled
      ? `Measured across ${analyzedFilesCount} of ${candidateFiles.length} source files (deterministic prioritization).`
      : `Measured across all ${analyzedFilesCount} source files.`;

    const locResult: LocAnalysisResult = {
      totalLines,
      codeLines,
      commentLines,
      blankLines,
      analyzedFilesCount,
      isSampled,
      samplingNote,
    };

    // 3. Assemble normalized report
    return buildRepositoryMetricsReport({
      metadata,
      tree,
      locResult,
      activity,
    });
  }

  /**
   * Deterministically analyzes repository Git history and code hotspots.
   */
  async analyzeGitHistory(
    owner: string,
    repo: string,
    options?: GitQueryOptions
  ): Promise<GitHistoryAnalysisReport> {
    const gitProvider = new GitHubGitProvider(this.client);
    const gitService = new GitService({ provider: gitProvider });
    return gitService.analyzeRepositoryHistory(owner, repo, options);
  }

  /**
   * Retrieves public pull requests for a repository.
   */
  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'all'
  ): Promise<PullRequestSummary[]> {
    const pullService = new PullRequestService({ client: this.client });
    return pullService.getPullRequests(owner, repo, state);
  }

  /**
   * Deterministically analyzes pull request changes and downstream dependency impact.
   */
  async analyzePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    graph?: DependencyGraph
  ): Promise<PullRequestImpactReport | null> {
    const pullService = new PullRequestService({ client: this.client });
    return pullService.analyzePullRequest(owner, repo, pullNumber, graph);
  }

  /**
   * Deterministically evaluates the health and hygiene of a repository.
   */
  async evaluateRepositoryHealth(
    owner: string,
    repo: string,
    options?: {
      metadata?: RepositoryMetadata;
      tree?: RepositoryTree;
      graph?: DependencyGraph;
      metrics?: RepositoryMetricsReport;
    }
  ): Promise<RepositoryHealthReport> {
    let metadata = options?.metadata;
    let tree = options?.tree;

    if (!metadata || !tree) {
      const ingestion = await this.ingestRepository(owner, repo);
      if (!ingestion.success) {
        throw new Error(ingestion.error.message);
      }
      metadata = ingestion.metadata;
      tree = ingestion.tree;
    }

    let commits = undefined;
    try {
      const gitProvider = new GitHubGitProvider(this.client);
      commits = await gitProvider.getCommits(owner, repo, { maxCommits: 100 });
    } catch {
      // In case commit listing fails or is rate-limited, proceed with metadata.pushedAt
    }

    return evaluateRepositoryHealth({
      metadata,
      tree,
      graph: options?.graph,
      metrics: options?.metrics,
      commits,
    });
  }
}

/**
 * Singleton repository service instance.
 */
export const repositoryService = new RepositoryService();
