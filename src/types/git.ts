/**
 * Git commit author / committer details.
 */
export interface GitAuthor {
  readonly name: string;
  readonly email: string;
  readonly date: string;
  readonly timestamp: number;
  readonly avatarUrl?: string;
  readonly username?: string;
}

/**
 * File change kind within a commit.
 */
export type GitFileChangeStatus = 'added' | 'modified' | 'removed' | 'renamed';

/**
 * Single file modified in a commit.
 */
export interface GitChangedFile {
  readonly path: string;
  readonly previousPath?: string;
  readonly status: GitFileChangeStatus;
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
}

/**
 * Normalized Git Commit model.
 */
export interface GitCommit {
  readonly sha: string;
  readonly shortSha: string;
  readonly author: GitAuthor;
  readonly committer: GitAuthor;
  readonly message: string;
  readonly subject: string;
  readonly body: string;
  readonly files: readonly GitChangedFile[];
  readonly additions: number;
  readonly deletions: number;
  readonly totalChanges: number;
  readonly parents: readonly string[];
  readonly url: string;
}

/**
 * Categorization of file change velocity / churn level.
 */
export type HotspotActivityTier = 'critical_churn' | 'high_churn' | 'moderate_churn' | 'stable';

/**
 * Deterministically computed repository hotspot for a single file.
 */
export interface FileHotspot {
  readonly path: string;
  readonly name: string;
  readonly changeCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly totalLinesChanged: number;
  readonly recentChangeCount: number; // in last 30 days
  readonly lastChangedDate: string;
  readonly hotspotScore: number; // 0 - 100
  readonly tier: HotspotActivityTier;
  readonly scoreBreakdown: {
    readonly frequencyFactor: number;
    readonly volumeFactor: number;
    readonly recencyFactor: number;
    readonly rawScore: number;
  };
}

/**
 * Chronological activity period (e.g. day or week bucket).
 */
export interface ActivityPeriod {
  readonly periodKey: string;
  readonly label: string;
  readonly commitCount: number;
  readonly additions: number;
  readonly deletions: number;
  readonly uniqueAuthors: readonly string[];
}

/**
 * Complete, normalized Git History and Hotspot Analysis report.
 */
export interface GitHistoryAnalysisReport {
  readonly repoId: string;
  readonly defaultBranch: string;
  readonly generatedAt: string;
  readonly summary: {
    readonly totalCommitsAnalyzed: number;
    readonly totalAdditions: number;
    readonly totalDeletions: number;
    readonly netGrowth: number;
    readonly uniqueAuthorsCount: number;
    readonly uniqueFilesChangedCount: number;
    readonly firstCommitDate: string | null;
    readonly latestCommitDate: string | null;
  };
  readonly hotspots: readonly FileHotspot[];
  readonly activityTimeline: readonly ActivityPeriod[];
  readonly recentCommits: readonly GitCommit[];
  readonly isSampled: boolean;
  readonly samplingNote: string;
  readonly scoringFormula: string;
}
