import type { IGitHistoryProvider, GitQueryOptions } from './types';
import type { GitCommit, GitChangedFile, GitFileChangeStatus } from '@/types/git';
import type { IGitHubClient } from '@/lib/github/client';

export interface RawCommitListItem {
  sha: string;
  html_url: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
  };
  author?: {
    login?: string;
    avatar_url?: string;
  };
  parents?: Array<{ sha: string }>;
}

export interface RawCommitDetailItem extends RawCommitListItem {
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  files?: Array<{
    filename: string;
    previous_filename?: string;
    status: string;
    additions: number;
    deletions: number;
    changes: number;
  }>;
}

/**
 * Git history provider powered by official GitHub REST APIs.
 */
export class GitHubGitProvider implements IGitHistoryProvider {
  private readonly client: IGitHubClient;

  constructor(client: IGitHubClient) {
    this.client = client;
  }

  async getCommits(
    owner: string,
    repo: string,
    options: GitQueryOptions = {}
  ): Promise<GitCommit[]> {
    if (!this.client.fetchCommits) {
      return [];
    }

    const limit = options.maxCommits || 30;
    const rawCommits = (await this.client.fetchCommits(owner, repo, limit)) as RawCommitListItem[];

    if (!Array.isArray(rawCommits) || rawCommits.length === 0) {
      return [];
    }

    // Fetch details (with file diff stats) for up to 20 commits
    const detailedLimit = Math.min(rawCommits.length, 20);
    const detailPromises = rawCommits.slice(0, detailedLimit).map(async (raw) => {
      if (this.client.fetchCommitDetails) {
        try {
          return (await this.client.fetchCommitDetails(
            owner,
            repo,
            raw.sha
          )) as RawCommitDetailItem | null;
        } catch {
          return null;
        }
      }
      return null;
    });

    const details = await Promise.all(detailPromises);
    const detailMap = new Map<string, RawCommitDetailItem>();
    for (const d of details) {
      if (d && d.sha) {
        detailMap.set(d.sha, d);
      }
    }

    return rawCommits.map((raw) => {
      const detailed = detailMap.get(raw.sha);
      const sha = raw.sha;
      const shortSha = sha.slice(0, 7);
      const message = raw.commit?.message || '';
      const lines = message.split('\n');
      const subject = lines[0]?.trim() || '';
      const body = lines.slice(1).join('\n').trim();

      const authorDate = raw.commit?.author?.date || new Date().toISOString();
      const committerDate = raw.commit?.committer?.date || authorDate;

      const changedFiles: GitChangedFile[] = [];
      let totalAdditions = 0;
      let totalDeletions = 0;

      if (detailed?.files && Array.isArray(detailed.files)) {
        for (const f of detailed.files) {
          const status = normalizeFileStatus(f.status);
          changedFiles.push({
            path: f.filename,
            previousPath: f.previous_filename,
            status,
            additions: f.additions || 0,
            deletions: f.deletions || 0,
            changes: f.changes || (f.additions || 0) + (f.deletions || 0),
          });
        }
        totalAdditions =
          detailed.stats?.additions ?? changedFiles.reduce((s, f) => s + f.additions, 0);
        totalDeletions =
          detailed.stats?.deletions ?? changedFiles.reduce((s, f) => s + f.deletions, 0);
      }

      return {
        sha,
        shortSha,
        author: {
          name: raw.commit?.author?.name || raw.author?.login || 'Unknown',
          email: raw.commit?.author?.email || '',
          date: authorDate,
          timestamp: new Date(authorDate).getTime(),
          avatarUrl: raw.author?.avatar_url,
          username: raw.author?.login,
        },
        committer: {
          name: raw.commit?.committer?.name || 'Unknown',
          email: raw.commit?.committer?.email || '',
          date: committerDate,
          timestamp: new Date(committerDate).getTime(),
        },
        message,
        subject,
        body,
        files: changedFiles,
        additions: totalAdditions,
        deletions: totalDeletions,
        totalChanges: totalAdditions + totalDeletions,
        parents: raw.parents?.map((p) => p.sha) || [],
        url: raw.html_url || `https://github.com/${owner}/${repo}/commit/${sha}`,
      };
    });
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<GitCommit | null> {
    if (!this.client.fetchCommitDetails) {
      return null;
    }

    const detailed = (await this.client.fetchCommitDetails(
      owner,
      repo,
      sha
    )) as RawCommitDetailItem | null;
    if (!detailed) return null;

    const shortSha = sha.slice(0, 7);
    const message = detailed.commit?.message || '';
    const lines = message.split('\n');
    const subject = lines[0]?.trim() || '';
    const body = lines.slice(1).join('\n').trim();

    const authorDate = detailed.commit?.author?.date || new Date().toISOString();
    const committerDate = detailed.commit?.committer?.date || authorDate;

    const changedFiles: GitChangedFile[] = [];
    if (detailed.files && Array.isArray(detailed.files)) {
      for (const f of detailed.files) {
        changedFiles.push({
          path: f.filename,
          previousPath: f.previous_filename,
          status: normalizeFileStatus(f.status),
          additions: f.additions || 0,
          deletions: f.deletions || 0,
          changes: f.changes || (f.additions || 0) + (f.deletions || 0),
        });
      }
    }

    const additions =
      detailed.stats?.additions ?? changedFiles.reduce((s, f) => s + f.additions, 0);
    const deletions =
      detailed.stats?.deletions ?? changedFiles.reduce((s, f) => s + f.deletions, 0);

    return {
      sha,
      shortSha,
      author: {
        name: detailed.commit?.author?.name || detailed.author?.login || 'Unknown',
        email: detailed.commit?.author?.email || '',
        date: authorDate,
        timestamp: new Date(authorDate).getTime(),
        avatarUrl: detailed.author?.avatar_url,
        username: detailed.author?.login,
      },
      committer: {
        name: detailed.commit?.committer?.name || 'Unknown',
        email: detailed.commit?.committer?.email || '',
        date: committerDate,
        timestamp: new Date(committerDate).getTime(),
      },
      message,
      subject,
      body,
      files: changedFiles,
      additions,
      deletions,
      totalChanges: additions + deletions,
      parents: detailed.parents?.map((p) => p.sha) || [],
      url: detailed.html_url || `https://github.com/${owner}/${repo}/commit/${sha}`,
    };
  }
}

function normalizeFileStatus(status: string): GitFileChangeStatus {
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
