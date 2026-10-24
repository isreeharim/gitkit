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
