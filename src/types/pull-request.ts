/**
 * Pull request lifecycle state.
 */
export type PullRequestState = 'open' | 'closed' | 'merged';

/**
 * Pull request author information.
 */
export interface PullRequestAuthor {
  readonly name: string;
  readonly username: string;
  readonly avatarUrl?: string;
  readonly url?: string;
}

/**
 * File change status in a pull request.
 */
export type PullRequestFileStatus = 'added' | 'modified' | 'removed' | 'renamed';

/**
 * Single file changed in a pull request.
 */
export interface PullRequestFile {
  readonly path: string;
  readonly previousPath?: string;
  readonly status: PullRequestFileStatus;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly patch?: string;
}

/**
 * Normalized Pull Request summary model (used in lists and overviews).
 */
export interface PullRequestSummary {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: PullRequestState;
  readonly isDraft: boolean;
  readonly author: PullRequestAuthor;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly closedAt: string | null;
  readonly mergedAt: string | null;
  readonly headBranch: string;
  readonly baseBranch: string;
  readonly headSha: string;
  readonly baseSha: string;
  readonly htmlUrl: string;
  readonly additions: number;
  readonly deletions: number;
  readonly totalChanges: number;
  readonly changedFilesCount: number;
  readonly commitsCount: number;
}

/**
 * Detailed Pull Request model including changed files.
 */
export interface PullRequestDetail extends PullRequestSummary {
  readonly files: readonly PullRequestFile[];
}

/**
 * Downstream affected module derived deterministically from dependency graph traversal.
 */
export interface AffectedModuleImpact {
  readonly path: string;
  readonly name: string;
  readonly isDirectlyChanged: boolean;
  readonly depth: number; // 0 = directly changed, 1 = direct dependent, 2+ = transitive dependent
  readonly importedByDirectPath?: string;
  readonly reason: string;
}

/**
 * Directory-level churn and impact summary.
 */
export interface DirectoryImpactSummary {
  readonly directory: string;
  readonly changedFilesCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly totalChanges: number;
  readonly percentageOfChanges: number; // 0 - 100
}

/**
 * Complete Pull Request Impact Analysis report.
 */
export interface PullRequestImpactReport {
  readonly repoId: string;
  readonly pr: PullRequestDetail;
  readonly totalFilesChanged: number;
  readonly totalAdditions: number;
  readonly totalDeletions: number;
  readonly netGrowth: number;
  readonly affectedDirectories: readonly DirectoryImpactSummary[];
  readonly largestChangedFiles: readonly PullRequestFile[];
  readonly directDependencies: readonly string[]; // packages or internal files imported by changed files
  readonly affectedModules: readonly AffectedModuleImpact[];
  readonly totalAffectedModulesCount: number;
  readonly changeConcentration: {
    readonly topDirectory: string;
    readonly topDirectoryPercentage: number;
    readonly fileTypeDistribution: Record<string, number>;
  };
  readonly disclaimer: string;
}
