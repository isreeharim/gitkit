import type { GitCommit } from '@/types/git';

export interface GitQueryOptions {
  branch?: string;
  maxCommits?: number;
  since?: string;
  until?: string;
  path?: string;
}

/**
 * Clean abstraction interface for Git history retrieval.
 * Can be implemented by GitHub API provider, isomorphic-git, or local filesystem Git.
 */
export interface IGitHistoryProvider {
  /**
   * Retrieves a list of commits with changed file statistics.
   */
  getCommits(owner: string, repo: string, options?: GitQueryOptions): Promise<GitCommit[]>;

  /**
   * Retrieves full details for a single commit.
   */
  getCommit(owner: string, repo: string, sha: string): Promise<GitCommit | null>;
}
