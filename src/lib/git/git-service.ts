import type { IGitHistoryProvider, GitQueryOptions } from './types';
import type { GitHistoryAnalysisReport } from '@/types/git';
import { analyzeCodeHotspots, HOTSPOT_FORMULA_DOCUMENTATION } from './hotspot-analyzer';
import { buildActivityTimeline } from './timeline-builder';

export interface GitServiceOptions {
  provider: IGitHistoryProvider;
}

export class GitService {
  private readonly provider: IGitHistoryProvider;

  constructor(options: GitServiceOptions) {
    this.provider = options.provider;
  }

  /**
   * Generates a deterministic Git history and code hotspot analysis report.
   */
  async analyzeRepositoryHistory(
    owner: string,
    repo: string,
    options: GitQueryOptions = {}
  ): Promise<GitHistoryAnalysisReport> {
    const maxCommits = options.maxCommits || 50;
    const branch = options.branch || 'HEAD';
    const commits = await this.provider.getCommits(owner, repo, {
      ...options,
      maxCommits,
    });

    const hotspots = analyzeCodeHotspots(commits);
    const activityTimeline = buildActivityTimeline(commits);

    // Summary calculations
    let totalAdditions = 0;
    let totalDeletions = 0;
    const authorSet = new Set<string>();
    const fileSet = new Set<string>();

    for (const commit of commits) {
      totalAdditions += commit.additions;
      totalDeletions += commit.deletions;
      if (commit.author.name) {
        authorSet.add(commit.author.name);
      }
      for (const f of commit.files) {
        fileSet.add(f.path);
      }
    }

    let firstCommitDate: string | null = null;
    let latestCommitDate: string | null = null;

    if (commits.length > 0) {
      // Find chronological min and max dates
      const timestamps = commits.map(
        (c) => c.author.timestamp || new Date(c.author.date).getTime()
      );
      const minTs = Math.min(...timestamps);
      const maxTs = Math.max(...timestamps);
      firstCommitDate = new Date(minTs).toISOString();
      latestCommitDate = new Date(maxTs).toISOString();
    }

    const isSampled = commits.length >= maxCommits;
    const samplingNote = isSampled
      ? `Analysis is based on the most recent ${commits.length} commits available.`
      : `Complete history analyzed (${commits.length} commits).`;

    return {
      repoId: `${owner}/${repo}`,
      defaultBranch: branch,
      generatedAt: new Date().toISOString(),
      summary: {
        totalCommitsAnalyzed: commits.length,
        totalAdditions,
        totalDeletions,
        netGrowth: totalAdditions - totalDeletions,
        uniqueAuthorsCount: authorSet.size,
        uniqueFilesChangedCount: fileSet.size,
        firstCommitDate,
        latestCommitDate,
      },
      hotspots,
      activityTimeline,
      recentCommits: commits.slice(0, 20),
      isSampled,
      samplingNote,
      scoringFormula: HOTSPOT_FORMULA_DOCUMENTATION,
    };
  }
}
