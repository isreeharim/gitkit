/**
 * Structured GitHub repository reference representing validated repository coordinates.
 */
export interface GitHubRepositoryReference {
  readonly owner: string;
  readonly repo: string;
  readonly normalizedUrl: string;
  readonly originalUrl: string;
  readonly gitkitRoute: string;
  readonly subpath?: string;
}

/**
 * Legacy repository coordinates for backward compatibility.
 */
export interface RepositoryCoordinates {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
}

/**
 * Result of validating and parsing a GitHub repository input string.
 */
export type ParseGitHubUrlResult =
  | {
      success: true;
      data: GitHubRepositoryReference;
      // Backward compatibility fields
      coordinates: RepositoryCoordinates;
      canonicalUrl: string;
    }
  | {
      success: false;
      error: string;
      originalUrl: string;
    };

/**
 * Legacy type alias for backward compatibility.
 */
export type ParseRepoResult = ParseGitHubUrlResult;

/**
 * Ingestion status for repository workspace lifecycle.
 */
export type IngestionStatus = 'idle' | 'resolving' | 'analyzing' | 'completed' | 'error';

/**
 * Clean internal model for open-source licenses.
 */
export interface RepositoryLicense {
  readonly key: string;
  readonly name: string;
  readonly spdxId: string | null;
  readonly url: string | null;
}

/**
 * Pure, typed internal domain model for ingested GitHub repository metadata.
 * Only contains fields GitKit requires, strictly decoupled from raw GitHub API schemas.
 */
export interface RepositoryMetadata {
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
  readonly description: string | null;
  readonly htmlUrl: string;
  readonly defaultBranch: string;
  readonly visibility: 'public' | 'private' | 'internal';
  readonly isFork: boolean;
  readonly isArchived: boolean;
  readonly stars: number;
  readonly forks: number;
  readonly openIssues: number;
  readonly watchers: number;
  readonly license: RepositoryLicense | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly pushedAt: string;
  readonly language: string | null;
  readonly topics: string[];
  readonly homepage: string | null;
  readonly sizeKb: number;
}

/**
 * Object type in a Git tree.
 */
export type TreeEntryType = 'blob' | 'tree' | 'submodule' | 'other';

/**
 * Single entry within a repository tree.
 */
export interface RepositoryTreeEntry {
  readonly path: string;
  readonly name: string;
  readonly type: TreeEntryType;
  readonly size?: number;
  readonly sha: string;
  readonly mode: string;
}

/**
 * Internal model for the ingested repository file tree.
 */
export interface RepositoryTree {
  readonly sha: string;
  readonly truncated: boolean;
  readonly entries: RepositoryTreeEntry[];
  readonly totalFiles: number;
  readonly totalDirectories: number;
  readonly totalBytes: number;
}

/**
 * Discriminator kinds for repository ingestion errors.
 */
export type RepositoryErrorKind =
  | 'not_found'
  | 'rate_limited'
  | 'unauthorized'
  | 'network_error'
  | 'github_unavailable'
  | 'invalid_repo'
  | 'unknown';

/**
 * Typed user-safe error representation for repository ingestion failures.
 */
export interface RepositoryIngestionError {
  readonly kind: RepositoryErrorKind;
  readonly message: string;
  readonly status?: number;
  readonly rateLimitReset?: string;
  readonly documentationUrl?: string;
}

/**
 * Result of the GitKit repository ingestion service.
 */
export type RepositoryIngestionResult =
  | {
      readonly success: true;
      readonly metadata: RepositoryMetadata;
      readonly tree: RepositoryTree;
    }
  | {
      readonly success: false;
      readonly error: RepositoryIngestionError;
    };
