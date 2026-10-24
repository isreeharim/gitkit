/**
 * Parsed GitHub repository coordinates.
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
export type ParseRepoResult =
  | { success: true; coordinates: RepositoryCoordinates; canonicalUrl: string }
  | { success: false; error: string };

/**
 * Foundation status interface for repository ingestion state.
 */
export type IngestionStatus = 'idle' | 'resolving' | 'analyzing' | 'completed' | 'error';
