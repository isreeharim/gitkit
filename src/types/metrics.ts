/**
 * Confidence level of a calculated metric.
 */
export type MetricConfidence =
  | 'exact' // 100% deterministic and complete from API or full tree
  | 'measured' // Measured from concrete repository structures
  | 'sampled' // Derived from a deterministic prioritized sample of files
  | 'approximate' // Best-effort approximation (e.g. GitHub reported disk size)
  | 'unavailable'; // Metric could not be determined (e.g. rate limit)

/**
 * Data provenance source for a metric.
 */
export type MetricSource = 'github_metadata' | 'git_tree' | 'source_analysis' | 'github_api';

/**
 * Standard typed metric item with value, metadata, unit, and methodology.
 */
export interface MetricItem<T = number | string | boolean | null> {
  readonly id: string;
  readonly label: string;
  readonly value: T;
  readonly unit: string;
  readonly formattedValue: string;
  readonly source: MetricSource;
  readonly calculationMethod: string;
  readonly confidence: MetricConfidence;
  readonly note?: string;
}

/**
 * Single detected language entry with byte and file count statistics.
 */
export interface LanguageMetric {
  readonly name: string;
  readonly color: string;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly percentageBytes: number;
  readonly percentageFiles: number;
}

/**
 * File extension statistics entry.
 */
export interface FileTypeMetric {
  readonly extension: string;
  readonly label: string;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly percentageBytes: number;
  readonly percentageFiles: number;
}

/**
 * Top file entry sorted by size.
 */
export interface LargestFileMetric {
  readonly path: string;
  readonly name: string;
  readonly sizeBytes: number;
  readonly formattedSize: string;
  readonly extension: string;
  readonly isGenerated: boolean;
}

/**
 * Top directory entry sorted by aggregated size or file count.
 */
export interface DirectorySizeMetric {
  readonly path: string;
  readonly fileCount: number;
  readonly totalBytes: number;
  readonly formattedSize: string;
  readonly depth: number;
}

/**
 * Deepest path entry.
 */
export interface DeepestPathMetric {
  readonly path: string;
  readonly depth: number;
  readonly segments: string[];
}

/**
 * Lines of Code (LOC) analysis breakdown.
 */
export interface LocAnalysisResult {
  readonly totalLines: number;
  readonly codeLines: number;
  readonly commentLines: number;
  readonly blankLines: number;
  readonly analyzedFilesCount: number;
  readonly isSampled: boolean;
  readonly samplingNote: string;
}

/**
 * Repository structure metrics aggregation.
 */
export interface StructureMetrics {
  readonly totalFiles: number;
  readonly totalDirectories: number;
  readonly maxDepth: number;
  readonly sourceFilesCount: number;
  readonly nonSourceFilesCount: number;
  readonly generatedFilesCount: number;
  readonly largestFiles: LargestFileMetric[];
  readonly largestDirectories: DirectorySizeMetric[];
  readonly deepestPaths: DeepestPathMetric[];
  readonly fileTypes: FileTypeMetric[];
  readonly languages: LanguageMetric[];
}

/**
 * Repository activity metrics from GitHub API.
 */
export interface ActivityMetrics {
  readonly commitCount: number | null;
  readonly contributorCount: number | null;
  readonly isCommitCountApproximate: boolean;
  readonly isContributorCountApproximate: boolean;
}

/**
 * Complete, normalized Repository Metrics Report.
 */
export interface RepositoryMetricsReport {
  readonly repoId: string;
  readonly generatedAt: string;
  readonly repository: {
    readonly stars: MetricItem<number>;
    readonly forks: MetricItem<number>;
    readonly openIssues: MetricItem<number>;
    readonly watchers: MetricItem<number>;
    readonly sizeKb: MetricItem<number>;
    readonly createdAt: MetricItem<string>;
    readonly updatedAt: MetricItem<string>;
    readonly pushedAt: MetricItem<string>;
    readonly defaultBranch: MetricItem<string>;
    readonly license: MetricItem<string | null>;
    readonly isArchived: MetricItem<boolean>;
    readonly isFork: MetricItem<boolean>;
  };
  readonly code: {
    readonly totalFiles: MetricItem<number>;
    readonly totalDirectories: MetricItem<number>;
    readonly sourceFiles: MetricItem<number>;
    readonly loc: LocAnalysisResult;
    readonly languages: LanguageMetric[];
  };
  readonly structure: StructureMetrics;
  readonly activity: ActivityMetrics;
}
