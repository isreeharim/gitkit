import type {
  PullRequestSummary,
  PullRequestDetail,
  PullRequestFile,
  PullRequestFileStatus,
  PullRequestState,
} from '@/types/pull-request';

export interface RawPullRequestItem {
  number: number;
  title: string;
  body?: string | null;
  state: string;
  draft?: boolean;
  user?: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  };
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  merged_at?: string | null;
  head?: {
    ref: string;
    sha: string;
  };
  base?: {
    ref: string;
    sha: string;
  };
  html_url: string;
  additions?: number;
  deletions?: number;
  changed_files?: number;
  commits?: number;
}

export interface RawPullRequestFileItem {
  filename: string;
  previous_filename?: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

/**
 * Normalizes file status from GitHub API.
 */
export function normalizePullRequestFileStatus(status: string): PullRequestFileStatus {
  switch (status.toLowerCase()) {
    case 'added':
      return 'added';
    case 'removed':
      return 'removed';
    case 'renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}

/**
 * Normalizes a raw PR changed file payload into GitKit's PullRequestFile model.
 */
export function normalizePullRequestFile(raw: RawPullRequestFileItem): PullRequestFile {
  const additions = raw.additions || 0;
  const deletions = raw.deletions || 0;
  const changes = raw.changes || additions + deletions;

  return {
    path: raw.filename,
    previousPath: raw.previous_filename,
    status: normalizePullRequestFileStatus(raw.status),
    additions,
    deletions,
    changes,
    patch: raw.patch,
  };
}

/**
 * Normalizes a raw GitHub pull request payload into GitKit's PullRequestSummary model.
 */
export function normalizePullRequestSummary(raw: RawPullRequestItem): PullRequestSummary {
  let state: PullRequestState = 'open';
  if (raw.merged_at) {
    state = 'merged';
  } else if (raw.state === 'closed') {
    state = 'closed';
  }

  const additions = raw.additions || 0;
  const deletions = raw.deletions || 0;

  return {
    number: raw.number,
    title: raw.title || `PR #${raw.number}`,
    body: raw.body || '',
    state,
    isDraft: Boolean(raw.draft),
    author: {
      name: raw.user?.login || 'Unknown',
      username: raw.user?.login || 'unknown',
      avatarUrl: raw.user?.avatar_url,
      url: raw.user?.html_url,
    },
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    closedAt: raw.closed_at ?? null,
    mergedAt: raw.merged_at ?? null,
    headBranch: raw.head?.ref || 'unknown',
    baseBranch: raw.base?.ref || 'main',
    headSha: raw.head?.sha || '',
    baseSha: raw.base?.sha || '',
    htmlUrl: raw.html_url,
    additions,
    deletions,
    totalChanges: additions + deletions,
    changedFilesCount: raw.changed_files ?? 0,
    commitsCount: raw.commits ?? 0,
  };
}

/**
 * Normalizes a detailed pull request and its changed files.
 */
export function normalizePullRequestDetail(
  rawPr: RawPullRequestItem,
  rawFiles: RawPullRequestFileItem[]
): PullRequestDetail {
  const summary = normalizePullRequestSummary(rawPr);
  const files = (rawFiles || []).map(normalizePullRequestFile);

  const calculatedAdditions = files.reduce((sum, f) => sum + f.additions, 0);
  const calculatedDeletions = files.reduce((sum, f) => sum + f.deletions, 0);

  return {
    ...summary,
    additions: summary.additions || calculatedAdditions,
    deletions: summary.deletions || calculatedDeletions,
    totalChanges:
      (summary.additions || calculatedAdditions) + (summary.deletions || calculatedDeletions),
    changedFilesCount: files.length || summary.changedFilesCount,
    files,
  };
}
