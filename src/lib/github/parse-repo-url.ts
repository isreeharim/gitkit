import type {
  GitHubRepositoryReference,
  ParseGitHubUrlResult,
  RepositoryCoordinates,
} from '@/types/repository';

/**
 * GitHub usernames/organizations:
 * - 1 to 39 characters
 * - Alphanumeric and single hyphens
 * - Cannot begin or end with a hyphen
 */
const OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

/**
 * GitHub repository names:
 * - 1 to 100 characters
 * - Alphanumeric, hyphens, underscores, dots
 * - Cannot be '.' or '..'
 */
const REPO_REGEX = /^(?!\.{1,2}$)[a-zA-Z0-9_.-]{1,100}$/;

/**
 * Reserved GitHub top-level paths that are not user or organization accounts.
 */
const RESERVED_GITHUB_ROOT_PATHS = new Set([
  'about',
  'account',
  'actions',
  'api',
  'collections',
  'contact',
  'customer-stories',
  'enterprise',
  'events',
  'explore',
  'features',
  'gist',
  'git-guides',
  'issues',
  'join',
  'login',
  'marketplace',
  'mobile',
  'new',
  'nonprofit',
  'notifications',
  'organizations',
  'orgs',
  'personal',
  'pricing',
  'pulls',
  'readme',
  'search',
  'security',
  'session',
  'settings',
  'signup',
  'sponsors',
  'stars',
  'team',
  'topics',
  'trending',
]);

/**
 * Deterministically validates raw owner and repo names.
 */
export function validateRepoCoordinates(
  owner: string,
  repo: string
): { isValid: boolean; error?: string } {
  if (!owner) {
    return { isValid: false, error: 'Repository owner is required.' };
  }
  if (!repo) {
    return { isValid: false, error: 'Repository name is required.' };
  }

  const cleanRepo = repo.replace(/\.git$/i, '');

  if (RESERVED_GITHUB_ROOT_PATHS.has(owner.toLowerCase())) {
    return {
      isValid: false,
      error: `"${owner}" is a reserved GitHub system path, not a valid repository owner.`,
    };
  }

  if (!OWNER_REGEX.test(owner)) {
    return {
      isValid: false,
      error: `Invalid GitHub owner: "${owner}". Must be 1-39 alphanumeric characters or hyphens (cannot start/end with hyphen).`,
    };
  }

  if (!REPO_REGEX.test(cleanRepo)) {
    return {
      isValid: false,
      error: `Invalid repository name: "${cleanRepo}". Must be 1-100 characters containing alphanumeric characters, hyphens, underscores, or dots.`,
    };
  }

  return { isValid: true };
}

/**
 * Deterministically parses and validates a GitHub repository string or URL.
 *
 * Supported formats:
 * - "https://github.com/owner/repo"
 * - "http://github.com/owner/repo"
 * - "https://www.github.com/owner/repo"
 * - "github.com/owner/repo"
 * - "www.github.com/owner/repo"
 * - "git@github.com:owner/repo.git"
 * - "owner/repo"
 * - URLs with trailing slashes, .git suffix, query parameters, or fragments
 * - Deep GitHub URLs containing subpaths (/issues, /pulls, /tree/main, /blob/..., /commit/..., /releases, /actions)
 */
export function parseGitHubRepoUrl(input: string): ParseGitHubUrlResult {
  const originalUrl = input;
  const trimmed = input.trim();

  if (!trimmed) {
    return {
      success: false,
      error: 'Please enter a GitHub repository URL or owner/repo format.',
      originalUrl,
    };
  }

  // Handle SSH format: git@github.com:owner/repo(.git)
  if (trimmed.startsWith('git@')) {
    if (!trimmed.startsWith('git@github.com:')) {
      return {
        success: false,
        error: 'Invalid SSH target: GitKit only supports GitHub repositories (git@github.com:).',
        originalUrl,
      };
    }

    const sshPath = trimmed.slice('git@github.com:'.length).trim();
    return processPathSegments(sshPath, originalUrl);
  }

  let cleanInput = trimmed;

  // Separate and strip fragments (#...)
  const hashIndex = cleanInput.indexOf('#');
  if (hashIndex !== -1) {
    cleanInput = cleanInput.slice(0, hashIndex);
  }

  // Separate and strip query parameters (?...)
  const queryIndex = cleanInput.indexOf('?');
  if (queryIndex !== -1) {
    cleanInput = cleanInput.slice(0, queryIndex);
  }

  cleanInput = cleanInput.trim();

  if (!cleanInput) {
    return {
      success: false,
      error: 'URL contains no path after stripping parameters.',
      originalUrl,
    };
  }

  // Check for protocol presence: e.g. http://, https://, or invalid protocol
  const protocolMatch = cleanInput.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.*)$/);

  let pathAfterDomain: string;

  if (protocolMatch) {
    const protocol = protocolMatch[1].toLowerCase();
    const afterProtocol = protocolMatch[2];

    if (protocol !== 'http' && protocol !== 'https') {
      return {
        success: false,
        error: `Unsupported protocol "${protocol}:". GitKit only supports HTTP and HTTPS GitHub URLs.`,
        originalUrl,
      };
    }

    // Extract domain and path
    const slashIdx = afterProtocol.indexOf('/');
    const domain = (
      slashIdx === -1 ? afterProtocol : afterProtocol.slice(0, slashIdx)
    ).toLowerCase();
    pathAfterDomain = slashIdx === -1 ? '' : afterProtocol.slice(slashIdx + 1);

    if (domain !== 'github.com' && domain !== 'www.github.com') {
      return {
        success: false,
        error: `Invalid domain "${domain}": GitKit only supports GitHub repositories (github.com).`,
        originalUrl,
      };
    }
  } else {
    // No protocol specified.
    // Could start with "github.com/", "www.github.com/", an external domain, or "owner/repo"
    const lower = cleanInput.toLowerCase();

    if (lower.startsWith('github.com/')) {
      pathAfterDomain = cleanInput.slice('github.com/'.length);
    } else if (lower.startsWith('www.github.com/')) {
      pathAfterDomain = cleanInput.slice('www.github.com/'.length);
    } else if (lower === 'github.com' || lower === 'www.github.com') {
      pathAfterDomain = '';
    } else {
      // Check if user entered another domain without protocol (e.g. "gitlab.com/owner/repo" or "example.com/a/b")
      // An owner name in GitHub can never contain dots.
      const firstSlash = cleanInput.indexOf('/');
      const firstSegment = firstSlash === -1 ? cleanInput : cleanInput.slice(0, firstSlash);

      if (firstSegment.includes('.')) {
        return {
          success: false,
          error: `Invalid domain "${firstSegment}": GitKit only supports GitHub repositories (github.com).`,
          originalUrl,
        };
      }

      pathAfterDomain = cleanInput;
    }
  }

  return processPathSegments(pathAfterDomain, originalUrl);
}

/**
 * Normalizes path segments to extract owner, repo, and subpath.
 */
function processPathSegments(path: string, originalUrl: string): ParseGitHubUrlResult {
  // Strip leading and trailing slashes
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');

  if (!trimmedPath) {
    return {
      success: false,
      error: 'Missing repository owner and name.',
      originalUrl,
    };
  }

  const segments = trimmedPath.split('/').filter(Boolean);

  if (segments.length === 0) {
    return {
      success: false,
      error: 'Missing repository owner and name.',
      originalUrl,
    };
  }

  if (segments.length === 1) {
    return {
      success: false,
      error: `Missing repository name. Found owner "${segments[0]}", expected "owner/repo".`,
      originalUrl,
    };
  }

  const owner = segments[0];
  const rawRepo = segments[1];
  const repo = rawRepo.replace(/\.git$/i, '');
  const subpathSegments = segments.slice(2);
  const subpath = subpathSegments.length > 0 ? subpathSegments.join('/') : undefined;

  const validation = validateRepoCoordinates(owner, repo);
  if (!validation.isValid) {
    return {
      success: false,
      error: validation.error ?? 'Invalid repository coordinates.',
      originalUrl,
    };
  }

  const canonicalUrl = `https://github.com/${owner}/${repo}`;
  const gitkitRoute = `/${owner}/${repo}`;

  const data: GitHubRepositoryReference = {
    owner,
    repo,
    normalizedUrl: canonicalUrl,
    originalUrl,
    gitkitRoute,
    ...(subpath ? { subpath } : {}),
  };

  const coordinates: RepositoryCoordinates = {
    owner,
    repo,
  };

  return {
    success: true,
    data,
    coordinates,
    canonicalUrl,
  };
}
