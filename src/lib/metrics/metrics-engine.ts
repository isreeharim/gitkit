import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import type {
  RepositoryMetricsReport,
  LocAnalysisResult,
  ActivityMetrics,
  MetricItem,
  StructureMetrics,
} from '@/types/metrics';
import { formatBytes } from '@/lib/utils';
import { analyzeRepositoryStructure } from './structure-analyzer';

export interface MetricsEngineInput {
  metadata: RepositoryMetadata;
  tree: RepositoryTree;
  locResult?: LocAnalysisResult;
  activity?: ActivityMetrics;
}

/**
 * Deterministically constructs a normalized RepositoryMetricsReport containing
 * repository, code, structural, and activity metrics with complete provenance and methodology.
 */
export function buildRepositoryMetricsReport(input: MetricsEngineInput): RepositoryMetricsReport {
  const { metadata, tree, locResult, activity } = input;
  const structure: StructureMetrics = analyzeRepositoryStructure(tree);

  const defaultLoc: LocAnalysisResult = locResult || {
    totalLines: 0,
    codeLines: 0,
    commentLines: 0,
    blankLines: 0,
    analyzedFilesCount: 0,
    isSampled: false,
    samplingNote: 'LOC analysis not performed on empty or unanalyzed repository.',
  };

  const defaultActivity: ActivityMetrics = activity || {
    commitCount: null,
    contributorCount: null,
    isCommitCountApproximate: false,
    isContributorCountApproximate: false,
  };

  // Helper to build typed metric items
  const createItem = <T>(
    id: string,
    label: string,
    value: T,
    unit: string,
    formattedValue: string,
    source: MetricItem<T>['source'],
    calculationMethod: string,
    confidence: MetricItem<T>['confidence'],
    note?: string
  ): MetricItem<T> => ({
    id,
    label,
    value,
    unit,
    formattedValue,
    source,
    calculationMethod,
    confidence,
    note,
  });

  return {
    repoId: `${metadata.owner}/${metadata.name}`,
    generatedAt: new Date().toISOString(),
    repository: {
      stars: createItem(
        'stars',
        'Stars',
        metadata.stars,
        'count',
        metadata.stars.toLocaleString(),
        'github_metadata',
        'Direct extraction from GitHub Repository API stargazers_count field.',
        'exact'
      ),
      forks: createItem(
        'forks',
        'Forks',
        metadata.forks,
        'count',
        metadata.forks.toLocaleString(),
        'github_metadata',
        'Direct extraction from GitHub Repository API forks_count field.',
        'exact'
      ),
      openIssues: createItem(
        'open_issues',
        'Open Issues',
        metadata.openIssues,
        'count',
        metadata.openIssues.toLocaleString(),
        'github_metadata',
        'Direct extraction from GitHub Repository API open_issues_count field.',
        'exact'
      ),
      watchers: createItem(
        'watchers',
        'Watchers',
        metadata.watchers,
        'count',
        metadata.watchers.toLocaleString(),
        'github_metadata',
        'Direct extraction from GitHub Repository API watchers_count field.',
        'exact'
      ),
      sizeKb: createItem(
        'size_kb',
        'Repository Size',
        metadata.sizeKb,
        'kilobytes',
        formatBytes(metadata.sizeKb * 1024),
        'github_metadata',
        'Direct extraction from GitHub Repository API size field reported in KB.',
        'approximate',
        'GitHub size includes commit history objects and packfiles on disk.'
      ),
      createdAt: createItem(
        'created_at',
        'Created',
        metadata.createdAt,
        'timestamp',
        new Date(metadata.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        'github_metadata',
        'Direct extraction from GitHub created_at ISO 8601 string.',
        'exact'
      ),
      updatedAt: createItem(
        'updated_at',
        'Updated',
        metadata.updatedAt,
        'timestamp',
        new Date(metadata.updatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        'github_metadata',
        'Direct extraction from GitHub updated_at ISO 8601 string.',
        'exact'
      ),
      pushedAt: createItem(
        'pushed_at',
        'Last Push',
        metadata.pushedAt,
        'timestamp',
        new Date(metadata.pushedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        'github_metadata',
        'Direct extraction from GitHub pushed_at ISO 8601 string.',
        'exact'
      ),
      defaultBranch: createItem(
        'default_branch',
        'Default Branch',
        metadata.defaultBranch,
        'name',
        metadata.defaultBranch,
        'github_metadata',
        'Direct extraction from GitHub default_branch field.',
        'exact'
      ),
      license: createItem(
        'license',
        'License',
        metadata.license?.name || null,
        'name',
        metadata.license?.spdxId || metadata.license?.name || 'None',
        'github_metadata',
        'Extracted from GitHub license schema or root LICENSE inspection.',
        metadata.license ? 'exact' : 'unavailable'
      ),
      isArchived: createItem(
        'is_archived',
        'Archived',
        metadata.isArchived,
        'boolean',
        metadata.isArchived ? 'Yes' : 'No',
        'github_metadata',
        'Direct extraction from GitHub archived flag.',
        'exact'
      ),
      isFork: createItem(
        'is_fork',
        'Fork',
        metadata.isFork,
        'boolean',
        metadata.isFork ? 'Yes' : 'No',
        'github_metadata',
        'Direct extraction from GitHub fork flag.',
        'exact'
      ),
    },
    code: {
      totalFiles: createItem(
        'total_files',
        'Total Files',
        structure.totalFiles,
        'count',
        structure.totalFiles.toLocaleString(),
        'git_tree',
        'Recursive count of all blob entries in the Git tree.',
        'measured'
      ),
      totalDirectories: createItem(
        'total_directories',
        'Total Directories',
        structure.totalDirectories,
        'count',
        structure.totalDirectories.toLocaleString(),
        'git_tree',
        'Recursive count of all tree entries in the Git tree.',
        'measured'
      ),
      sourceFiles: createItem(
        'source_files',
        'Source Files',
        structure.sourceFilesCount,
        'count',
        structure.sourceFilesCount.toLocaleString(),
        'git_tree',
        'Deterministic classification via Linguist-aligned extension and file mapping.',
        'measured'
      ),
      loc: defaultLoc,
      languages: structure.languages,
    },
    structure,
    activity: defaultActivity,
  };
}
