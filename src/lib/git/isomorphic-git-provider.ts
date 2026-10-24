import git from 'isomorphic-git';
import type { IGitHistoryProvider, GitQueryOptions } from './types';
import type { GitCommit, GitChangedFile, GitFileChangeStatus } from '@/types/git';

type GitFs = Parameters<typeof git.log>[0]['fs'];

export interface IsomorphicGitOptions {
  fs: GitFs;
  dir: string;
}

/**
 * Git history provider powered by isomorphic-git.
 * Suitable for in-memory virtual filesystems, local test fixtures, and client-side repos.
 */
export class IsomorphicGitProvider implements IGitHistoryProvider {
  private readonly fs: GitFs;
  private readonly dir: string;

  constructor(options: IsomorphicGitOptions) {
    this.fs = options.fs;
    this.dir = options.dir;
  }

  async getCommits(
    _owner: string,
    _repo: string,
    options: GitQueryOptions = {}
  ): Promise<GitCommit[]> {
    const depth = options.maxCommits || 50;
    const ref = options.branch || 'HEAD';

    try {
      const commitEntries = await git.log({
        fs: this.fs,
        dir: this.dir,
        ref,
        depth,
      });

      const normalizedCommits: GitCommit[] = [];

      for (let i = 0; i < commitEntries.length; i++) {
        const entry = commitEntries[i];
        const sha = entry.oid;
        const shortSha = sha.slice(0, 7);
        const { author, committer, message, parent } = entry.commit;

        const dateStr = new Date((author.timestamp || 0) * 1000).toISOString();
        const committerDateStr = new Date((committer.timestamp || 0) * 1000).toISOString();

        // Split message into subject and body
        const messageLines = (message || '').split('\n');
        const subject = messageLines[0]?.trim() || '';
        const body = messageLines.slice(1).join('\n').trim();

        // Calculate changed files relative to parent commit if parent exists
        const changedFiles: GitChangedFile[] = [];
        let additions = 0;
        let deletions = 0;

        const parentOid = parent && parent.length > 0 ? parent[0] : undefined;

        if (parentOid) {
          try {
            const matrix = await git.walk({
              fs: this.fs,
              dir: this.dir,
              trees: [git.TREE({ ref: parentOid }), git.TREE({ ref: sha })],
              map: async (filepath, [parentHead, currentHead]) => {
                if (filepath === '.') return null;
                const parentType = parentHead ? await parentHead.type() : null;
                const currentType = currentHead ? await currentHead.type() : null;

                if (parentType === 'tree' || currentType === 'tree') {
                  return null;
                }

                let status: GitFileChangeStatus = 'modified';
                if (!parentHead && currentHead) {
                  status = 'added';
                } else if (parentHead && !currentHead) {
                  status = 'removed';
                } else if (parentHead && currentHead) {
                  const parentOidVal = await parentHead.oid();
                  const currentOidVal = await currentHead.oid();
                  if (parentOidVal === currentOidVal) {
                    return null; // Unchanged file
                  }
                  status = 'modified';
                }

                // Placeholder delta estimate when tree blob diffing is not expanded
                const estChanges = 1;
                return {
                  path: filepath,
                  status,
                  additions: status === 'added' ? estChanges : 1,
                  deletions: status === 'removed' ? estChanges : 0,
                  changes: estChanges,
                };
              },
            });

            for (const item of matrix) {
              if (item) {
                changedFiles.push(item);
                additions += item.additions;
                deletions += item.deletions;
              }
            }
          } catch {
            // Graceful fallback if walking matrix fails on root commit
          }
        }

        normalizedCommits.push({
          sha,
          shortSha,
          author: {
            name: author.name || 'Unknown',
            email: author.email || '',
            date: dateStr,
            timestamp: (author.timestamp || 0) * 1000,
          },
          committer: {
            name: committer.name || 'Unknown',
            email: committer.email || '',
            date: committerDateStr,
            timestamp: (committer.timestamp || 0) * 1000,
          },
          message,
          subject,
          body,
          files: changedFiles,
          additions,
          deletions,
          totalChanges: additions + deletions,
          parents: parent || [],
          url: '',
        });
      }

      return normalizedCommits;
    } catch {
      return [];
    }
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<GitCommit | null> {
    const commits = await this.getCommits(owner, repo, { maxCommits: 100 });
    return commits.find((c) => c.sha === sha || c.shortSha === sha) || null;
  }
}
