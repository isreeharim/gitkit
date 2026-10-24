import type { ParseRepoResult } from '@/types/repository';

// GitHub username: alphanumeric and single hyphens, not starting or ending with hyphen, max 39 chars
const OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
// GitHub repo name: alphanumeric, hyphens, underscores, dots, max 100 chars
const REPO_REGEX = /^[a-zA-Z0-9_.-]{1,100}$/;

/**
 * Deterministically parses and validates a GitHub repository string or URL.
 * Supports:
 * - "owner/repo"
 * - "https://github.com/owner/repo"
 * - "http://github.com/owner/repo"
 * - "git@github.com:owner/repo.git"
 * - "https://github.com/owner/repo.git"
 */
export function parseGitHubRepoUrl(input: string): ParseRepoResult {
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      success: false,
      error: 'Please enter a GitHub repository URL or owner/repo format.',
    };
  }

  let normalized = trimmed;

  // Handle SSH format: git@github.com:owner/repo(.git)
  if (normalized.startsWith('git@github.com:')) {
    normalized = normalized.replace('git@github.com:', '');
  } else {
    // Strip protocol
    normalized = normalized.replace(/^https?:\/\//i, '');
    // Strip domain
    normalized = normalized.replace(/^github\.com\//i, '');
  }

  // Strip leading and trailing slashes
  normalized = normalized.replace(/^\/+|\/+$/g, '');
  // Strip trailing .git
  normalized = normalized.replace(/\.git$/i, '');
  // Strip any remaining trailing slash
  normalized = normalized.replace(/\/+$/g, '');

  const segments = normalized.split('/').filter(Boolean);

  if (segments.length < 2) {
    return {
      success: false,
      error: 'Invalid format. Expected "owner/repo" or full GitHub URL.',
    };
  }

  const [owner, repo] = segments;

  if (!OWNER_REGEX.test(owner)) {
    return {
      success: false,
      error: `Invalid GitHub owner/organization name: "${owner}".`,
    };
  }

  if (!REPO_REGEX.test(repo)) {
    return {
      success: false,
      error: `Invalid repository name: "${repo}".`,
    };
  }

  return {
    success: true,
    coordinates: {
      owner,
      repo,
    },
    canonicalUrl: `https://github.com/${owner}/${repo}`,
  };
}
