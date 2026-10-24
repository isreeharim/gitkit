import { Octokit } from 'octokit';
import type { RepositoryErrorKind } from '@/types/repository';

/**
 * Standard typed error emitted by the GitHub client layer.
 */
export class GitHubApiError extends Error {
  readonly kind: RepositoryErrorKind;
  readonly status?: number;
  readonly rateLimitReset?: string;

  constructor(
    message: string,
    kind: RepositoryErrorKind,
    status?: number,
    rateLimitReset?: string
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.kind = kind;
    this.status = status;
    this.rateLimitReset = rateLimitReset;
  }
}

/**
 * Raw repository response shape extracted from Octokit.
 */
export interface RawGitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  visibility?: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  default_branch: string;
  topics?: string[];
  homepage?: string | null;
  owner: {
    login: string;
    avatar_url?: string;
  };
  license: {
    key: string;
    name: string;
    spdx_id: string | null;
    url: string | null;
  } | null;
}

/**
 * Raw tree entry from GitHub Git Trees API.
 */
export interface RawGitHubTreeEntry {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
  url?: string;
}

/**
 * Raw tree response shape from GitHub Git Trees API.
 */
export interface RawGitHubTree {
  sha: string;
  url: string;
  truncated: boolean;
  tree: RawGitHubTreeEntry[];
}

/**
 * Interface contract for GitHub client operations.
 */
export interface IGitHubClient {
  fetchRepository(owner: string, repo: string): Promise<RawGitHubRepository>;
  fetchTree(owner: string, repo: string, treeSha: string): Promise<RawGitHubTree>;
  fetchBlobContent(owner: string, repo: string, fileSha: string): Promise<string | null>;
  fetchFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string | null>;
  fetchCommitCount?(owner: string, repo: string): Promise<number | null>;
  fetchContributorCount?(owner: string, repo: string): Promise<number | null>;
  fetchCommits?(owner: string, repo: string, perPage?: number): Promise<unknown[]>;
  fetchCommitDetails?(owner: string, repo: string, ref: string): Promise<unknown | null>;
}

export interface GitHubClientOptions {
  auth?: string;
  octokit?: Octokit;
  userAgent?: string;
}

/**
 * Clean GitHub API client isolating Octokit interactions, authentication,
 * and deterministic error classification.
 */
export class GitHubClient implements IGitHubClient {
  private readonly octokit: Octokit;

  constructor(options: GitHubClientOptions = {}) {
    if (options.octokit) {
      this.octokit = options.octokit;
    } else {
      // Prioritize explicit auth, then server-side environment tokens.
      // Never expose token to client bundles.
      const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
      const token =
        options.auth ||
        (typeof process !== 'undefined' ? process.env?.GITHUB_TOKEN : undefined) ||
        metaEnv?.GITHUB_TOKEN;

      this.octokit = new Octokit({
        auth: token || undefined,
        userAgent: options.userAgent || 'GitKit/0.1 (+https://gitkit.in)',
        request: {
          timeout: 10000,
        },
        retry: {
          enabled: false,
        },
        throttle: {
          onRateLimit: () => false,
          onSecondaryRateLimit: () => false,
        },
      });
    }
  }

  /**
   * Fetches public repository metadata from GitHub.
   */
  async fetchRepository(owner: string, repo: string): Promise<RawGitHubRepository> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
      });

      return response.data as RawGitHubRepository;
    } catch (err: unknown) {
      throw this.transformError(err, `${owner}/${repo}`);
    }
  }

  /**
   * Fetches the recursive Git tree for a specific tree SHA or default branch.
   */
  async fetchTree(owner: string, repo: string, treeSha: string): Promise<RawGitHubTree> {
    try {
      const response = await this.octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive: 'true',
      });

      return response.data as RawGitHubTree;
    } catch (err: unknown) {
      throw this.transformError(err, `${owner}/${repo} (tree: ${treeSha})`);
    }
  }

  /**
   * Fetches raw blob content from GitHub by Git tree SHA.
   */
  async fetchBlobContent(owner: string, repo: string, fileSha: string): Promise<string | null> {
    try {
      const response = await this.octokit.rest.git.getBlob({
        owner,
        repo,
        file_sha: fileSha,
      });

      if (response.data.content) {
        return decodeBase64Utf8(response.data.content);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches raw content of a file from GitHub by repository path.
   */
  async fetchFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string
  ): Promise<string | null> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if ('content' in response.data && typeof response.data.content === 'string') {
        return decodeBase64Utf8(response.data.content);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches the total commit count on the default branch using the Link header pagination trick.
   */
  async fetchCommitCount(owner: string, repo: string): Promise<number | null> {
    try {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });

      const linkHeader = response.headers.link;
      if (linkHeader) {
        const lastMatch = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(linkHeader);
        if (lastMatch) {
          return parseInt(lastMatch[1], 10);
        }
      }
      return Array.isArray(response.data) ? response.data.length : null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches the total contributor count using the Link header pagination trick.
   */
  async fetchContributorCount(owner: string, repo: string): Promise<number | null> {
    try {
      const response = await this.octokit.rest.repos.listContributors({
        owner,
        repo,
        per_page: 1,
        anon: 'true',
      });

      const linkHeader = response.headers.link;
      if (linkHeader) {
        const lastMatch = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/.exec(linkHeader);
        if (lastMatch) {
          return parseInt(lastMatch[1], 10);
        }
      }
      return Array.isArray(response.data) ? response.data.length : null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches paginated commit list from GitHub.
   */
  async fetchCommits(owner: string, repo: string, perPage = 30): Promise<unknown[]> {
    try {
      const response = await this.octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: perPage,
      });
      return response.data;
    } catch (err: unknown) {
      throw this.transformError(err, `${owner}/${repo} (commits)`);
    }
  }

  /**
   * Fetches detailed commit data including changed files from GitHub.
   */
  async fetchCommitDetails(owner: string, repo: string, ref: string): Promise<unknown | null> {
    try {
      const response = await this.octokit.rest.repos.getCommit({
        owner,
        repo,
        ref,
      });
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Translates Octokit / HTTP errors into deterministic, user-safe GitKit errors.
   */
  private transformError(err: unknown, target: string): GitHubApiError {
    if (err instanceof GitHubApiError) {
      return err;
    }

    const anyErr = err as {
      status?: number;
      message?: string;
      response?: {
        headers?: Record<string, string>;
        data?: { message?: string };
      };
    };

    const status = anyErr?.status;
    const message = anyErr?.response?.data?.message || anyErr?.message || '';
    const headers = anyErr?.response?.headers || {};

    // Rate limiting detection (HTTP 403/429 with remaining=0 or rate limit message)
    const isRateLimited =
      status === 429 ||
      (status === 403 &&
        (headers['x-ratelimit-remaining'] === '0' ||
          /rate limit/i.test(message) ||
          /secondary rate limit/i.test(message)));

    if (isRateLimited) {
      const resetEpoch = headers['x-ratelimit-reset'];
      let resetTime: string | undefined;
      if (resetEpoch) {
        const date = new Date(parseInt(resetEpoch, 10) * 1000);
        resetTime = date.toISOString();
      }

      return new GitHubApiError(
        'GitHub API rate limit exceeded. Please wait a few moments before trying again.',
        'rate_limited',
        status,
        resetTime
      );
    }

    if (status === 404) {
      return new GitHubApiError(
        `Repository "${target}" was not found on GitHub. Verify the owner and repository name.`,
        'not_found',
        404
      );
    }

    if (status === 401 || status === 403) {
      return new GitHubApiError(
        `Access to repository "${target}" is restricted or private. GitKit currently only supports public repositories.`,
        'unauthorized',
        status
      );
    }

    if (status && status >= 500 && status < 600) {
      return new GitHubApiError(
        'GitHub API is currently experiencing service disruptions. Please try again later.',
        'github_unavailable',
        status
      );
    }

    // Network / fetch connectivity errors
    if (/fetch|network|ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(message)) {
      return new GitHubApiError(
        'Network error: Failed to connect to GitHub API. Please check your internet connection.',
        'network_error'
      );
    }

    return new GitHubApiError(
      `Unable to retrieve repository information (${message || 'unknown error'}).`,
      'unknown',
      status
    );
  }
}

/**
 * Safely decodes base64 string to UTF-8 across Node and Cloudflare Workers.
 */
function decodeBase64Utf8(base64Str: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(base64Str, 'base64').toString('utf-8');
    }
    const clean = base64Str.replace(/\s/g, '');
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}
