import { describe, it, expect, vi } from 'vitest';
import {
  analyzeCodeHotspots,
  buildActivityTimeline,
  GitService,
  GitHubGitProvider,
  IsomorphicGitProvider,
  HOTSPOT_FORMULA_DOCUMENTATION,
  type IGitHistoryProvider,
} from '@/lib/git';
import type { GitCommit } from '@/types/git';
import type { IGitHubClient } from '@/lib/github/client';

function makeMockCommit(overrides: Partial<GitCommit> = {}): GitCommit {
  const sha = overrides.sha || 'abcdef1234567890abcdef1234567890abcdef12';
  const authorDate = overrides.author?.date || '2026-10-20T12:00:00Z';
  const timestamp = overrides.author?.timestamp || new Date(authorDate).getTime();

  return {
    sha,
    shortSha: sha.slice(0, 7),
    author: {
      name: overrides.author?.name || 'Alice Dev',
      email: overrides.author?.email || 'alice@example.com',
      date: authorDate,
      timestamp,
      username: 'alicedev',
    },
    committer: {
      name: overrides.committer?.name || 'Alice Dev',
      email: overrides.committer?.email || 'alice@example.com',
      date: authorDate,
      timestamp,
    },
    message: overrides.message || 'feat: test commit',
    subject: overrides.subject || 'feat: test commit',
    body: overrides.body || '',
    files: overrides.files || [
      {
        path: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 2,
        changes: 12,
      },
    ],
    additions: overrides.additions ?? 10,
    deletions: overrides.deletions ?? 2,
    totalChanges: overrides.totalChanges ?? 12,
    parents: overrides.parents || ['1111111111111111111111111111111111111111'],
    url: overrides.url || 'https://github.com/owner/repo/commit/' + sha,
  };
}

describe('Git Hotspot Analyzer', () => {
  it('returns empty array when commits array is empty', () => {
    expect(analyzeCodeHotspots([])).toEqual([]);
  });

  it('calculates score and normalizes highest raw score to 100 for single file', () => {
    const commit = makeMockCommit({
      author: {
        name: 'Bob',
        email: 'bob@example.com',
        date: '2026-10-20T10:00:00Z',
        timestamp: new Date('2026-10-20T10:00:00Z').getTime(),
      },
      files: [
        {
          path: 'src/core/engine.ts',
          status: 'modified',
          additions: 50,
          deletions: 10,
          changes: 60,
        },
      ],
    });

    const hotspots = analyzeCodeHotspots([commit]);

    expect(hotspots).toHaveLength(1);
    expect(hotspots[0].path).toBe('src/core/engine.ts');
    expect(hotspots[0].name).toBe('engine.ts');
    expect(hotspots[0].changeCount).toBe(1);
    expect(hotspots[0].additions).toBe(50);
    expect(hotspots[0].deletions).toBe(10);
    expect(hotspots[0].totalLinesChanged).toBe(60);
    expect(hotspots[0].hotspotScore).toBe(100);
    expect(hotspots[0].tier).toBe('critical_churn');
    expect(hotspots[0].scoreBreakdown.frequencyFactor).toBe(1);
  });

  it('ranks frequently churned files higher and dampens line volume with ln(L + 1)', () => {
    const refDate = new Date('2026-10-24T12:00:00Z');

    // File A: Modified 5 times with moderate lines (20 lines each = 100 lines total)
    const commitsForA: GitCommit[] = Array.from({ length: 5 }, (_, i) =>
      makeMockCommit({
        sha: `sha_a_${i}`,
        author: {
          name: 'Alice',
          email: 'alice@example.com',
          date: new Date(refDate.getTime() - i * 86400000).toISOString(),
          timestamp: refDate.getTime() - i * 86400000,
        },
        files: [
          {
            path: 'src/components/Header.tsx',
            status: 'modified',
            additions: 15,
            deletions: 5,
            changes: 20,
          },
        ],
      })
    );

    // File B: Modified once with huge lines (e.g. 5,000 lines bundle or dump)
    const commitForB = makeMockCommit({
      sha: 'sha_b_0',
      author: {
        name: 'Bot',
        email: 'bot@example.com',
        date: refDate.toISOString(),
        timestamp: refDate.getTime(),
      },
      files: [
        {
          path: 'public/vendor.bundle.js',
          status: 'added',
          additions: 5000,
          deletions: 0,
          changes: 5000,
        },
      ],
    });

    const hotspots = analyzeCodeHotspots([...commitsForA, commitForB], {
      referenceDate: refDate,
    });

    expect(hotspots.length).toBe(2);
    // Header.tsx (5 commits * ln(101) * ~0.98 = ~22.6) should beat vendor.bundle.js (1 commit * ln(5001) * 1.0 = ~8.5)
    expect(hotspots[0].path).toBe('src/components/Header.tsx');
    expect(hotspots[0].hotspotScore).toBe(100);
    expect(hotspots[1].path).toBe('public/vendor.bundle.js');
    expect(hotspots[1].hotspotScore).toBeLessThan(50);
  });

  it('applies recency decay weight to older commits', () => {
    const refDate = new Date('2026-10-24T12:00:00Z');

    // Recent file: changed 3 days ago
    const recentCommit = makeMockCommit({
      sha: 'sha_recent',
      author: {
        name: 'Alice',
        email: 'alice@example.com',
        date: new Date(refDate.getTime() - 3 * 86400000).toISOString(),
        timestamp: refDate.getTime() - 3 * 86400000,
      },
      files: [
        {
          path: 'src/active.ts',
          status: 'modified',
          additions: 20,
          deletions: 10,
          changes: 30,
        },
      ],
    });

    // Old file: changed 150 days ago (past the 90 day window)
    const oldCommit = makeMockCommit({
      sha: 'sha_old',
      author: {
        name: 'Alice',
        email: 'alice@example.com',
        date: new Date(refDate.getTime() - 150 * 86400000).toISOString(),
        timestamp: refDate.getTime() - 150 * 86400000,
      },
      files: [
        {
          path: 'src/stale.ts',
          status: 'modified',
          additions: 20,
          deletions: 10,
          changes: 30,
        },
      ],
    });

    const hotspots = analyzeCodeHotspots([recentCommit, oldCommit], {
      referenceDate: refDate,
    });

    const activeHotspot = hotspots.find((h) => h.path === 'src/active.ts')!;
    const staleHotspot = hotspots.find((h) => h.path === 'src/stale.ts')!;

    expect(activeHotspot.hotspotScore).toBe(100);
    expect(staleHotspot.hotspotScore).toBeLessThan(35);
    expect(activeHotspot.scoreBreakdown.recencyFactor).toBeGreaterThan(0.9);
    expect(staleHotspot.scoreBreakdown.recencyFactor).toBe(0.2); // clamped at minRecencyWeight
  });

  it('categorizes tiers correctly based on score thresholds', () => {
    const refDate = new Date('2026-10-24T12:00:00Z');

    const commits = [
      makeMockCommit({
        sha: 'c1',
        files: [
          { path: 'critical.ts', status: 'modified', additions: 100, deletions: 10, changes: 110 },
        ],
      }),
      makeMockCommit({
        sha: 'c2',
        files: [
          { path: 'critical.ts', status: 'modified', additions: 50, deletions: 5, changes: 55 },
        ],
      }),
      makeMockCommit({
        sha: 'c3',
        files: [
          { path: 'critical.ts', status: 'modified', additions: 50, deletions: 5, changes: 55 },
        ],
      }),
      makeMockCommit({
        sha: 'c4',
        files: [{ path: 'stable.ts', status: 'modified', additions: 1, deletions: 1, changes: 2 }],
      }),
    ];

    const hotspots = analyzeCodeHotspots(commits, { referenceDate: refDate });
    const critical = hotspots.find((h) => h.path === 'critical.ts')!;
    const stable = hotspots.find((h) => h.path === 'stable.ts')!;

    expect(critical.tier).toBe('critical_churn');
    expect(critical.hotspotScore).toBe(100);
    expect(stable.tier).toBe('stable');
    expect(stable.hotspotScore).toBeLessThan(25);
  });
});

describe('Git Timeline Builder', () => {
  it('returns empty array when commits array is empty', () => {
    expect(buildActivityTimeline([])).toEqual([]);
  });

  it('buckets commits into ISO week activity periods chronologically', () => {
    const commits: GitCommit[] = [
      makeMockCommit({
        sha: 'c1',
        author: {
          name: 'Alice',
          email: 'alice@example.com',
          date: '2026-10-12T10:00:00Z',
          timestamp: new Date('2026-10-12T10:00:00Z').getTime(),
        },
        additions: 25,
        deletions: 5,
      }),
      makeMockCommit({
        sha: 'c2',
        author: {
          name: 'Bob',
          email: 'bob@example.com',
          date: '2026-10-14T15:00:00Z',
          timestamp: new Date('2026-10-14T15:00:00Z').getTime(),
        },
        additions: 15,
        deletions: 10,
      }),
      makeMockCommit({
        sha: 'c3',
        author: {
          name: 'Alice',
          email: 'alice@example.com',
          date: '2026-10-21T11:00:00Z',
          timestamp: new Date('2026-10-21T11:00:00Z').getTime(),
        },
        additions: 40,
        deletions: 2,
      }),
    ];

    const timeline = buildActivityTimeline(commits);

    expect(timeline.length).toBe(2);

    // Week 1 (Oct 12 & 14, 2026)
    const week1 = timeline[0];
    expect(week1.commitCount).toBe(2);
    expect(week1.additions).toBe(40);
    expect(week1.deletions).toBe(15);
    expect(week1.uniqueAuthors).toEqual(['Alice', 'Bob']);

    // Week 2 (Oct 21, 2026)
    const week2 = timeline[1];
    expect(week2.commitCount).toBe(1);
    expect(week2.additions).toBe(40);
    expect(week2.deletions).toBe(2);
    expect(week2.uniqueAuthors).toEqual(['Alice']);
  });
});

describe('GitHubGitProvider', () => {
  it('normalizes GitHub commits and file diff details correctly', async () => {
    const mockClient: IGitHubClient = {
      fetchRepository: vi.fn(),
      fetchTree: vi.fn(),
      fetchFileContent: vi.fn(),
      fetchBlobContent: vi.fn(),
      fetchCommitCount: vi.fn(),
      fetchContributorCount: vi.fn(),
      fetchCommits: vi.fn().mockResolvedValue([
        {
          sha: 'abcdef1234567890abcdef1234567890abcdef12',
          html_url: 'https://github.com/owner/repo/commit/abcdef1234567890',
          commit: {
            author: { name: 'Dev', email: 'dev@git.com', date: '2026-10-20T10:00:00Z' },
            committer: { name: 'Dev', email: 'dev@git.com', date: '2026-10-20T10:00:00Z' },
            message: 'feat: add git engine\n\nDetailed breakdown of changes.',
          },
          author: { login: 'devuser', avatar_url: 'https://avatars.github.com/u/123' },
          parents: [{ sha: 'parentsha' }],
        },
      ]),
      fetchCommitDetails: vi.fn().mockResolvedValue({
        sha: 'abcdef1234567890abcdef1234567890abcdef12',
        stats: { total: 30, additions: 25, deletions: 5 },
        files: [
          {
            filename: 'src/lib/git.ts',
            status: 'added',
            additions: 25,
            deletions: 5,
            changes: 30,
          },
        ],
      }),
    };

    const provider = new GitHubGitProvider(mockClient);
    const commits = await provider.getCommits('owner', 'repo', { maxCommits: 5 });

    expect(commits).toHaveLength(1);
    const c = commits[0];
    expect(c.sha).toBe('abcdef1234567890abcdef1234567890abcdef12');
    expect(c.shortSha).toBe('abcdef1');
    expect(c.subject).toBe('feat: add git engine');
    expect(c.body).toBe('Detailed breakdown of changes.');
    expect(c.author.name).toBe('Dev');
    expect(c.author.avatarUrl).toBe('https://avatars.github.com/u/123');
    expect(c.additions).toBe(25);
    expect(c.deletions).toBe(5);
    expect(c.files).toHaveLength(1);
    expect(c.files[0].path).toBe('src/lib/git.ts');
    expect(c.files[0].status).toBe('added');
  });

  it('handles empty results and missing fetchCommits gracefully', async () => {
    const mockClientEmpty: IGitHubClient = {
      fetchRepository: vi.fn(),
      fetchTree: vi.fn(),
      fetchFileContent: vi.fn(),
      fetchBlobContent: vi.fn(),
    };

    const provider = new GitHubGitProvider(mockClientEmpty);
    const commits = await provider.getCommits('owner', 'repo');
    expect(commits).toEqual([]);
  });
});

describe('IsomorphicGitProvider', () => {
  it('handles missing directory gracefully without throwing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockFs = {} as any;
    const provider = new IsomorphicGitProvider({ fs: mockFs, dir: '/nonexistent' });

    const commits = await provider.getCommits('owner', 'repo');
    expect(commits).toEqual([]);

    const single = await provider.getCommit('owner', 'repo', 'unknown');
    expect(single).toBeNull();
  });
});

describe('GitService', () => {
  it('aggregates repository history report deterministically', async () => {
    const mockCommits: GitCommit[] = [
      makeMockCommit({
        sha: 'c1',
        author: {
          name: 'Alice',
          email: 'alice@example.com',
          date: '2026-10-10T10:00:00Z',
          timestamp: new Date('2026-10-10T10:00:00Z').getTime(),
        },
        additions: 30,
        deletions: 10,
        files: [
          { path: 'src/main.ts', status: 'modified', additions: 20, deletions: 5, changes: 25 },
          { path: 'src/util.ts', status: 'modified', additions: 10, deletions: 5, changes: 15 },
        ],
      }),
      makeMockCommit({
        sha: 'c2',
        author: {
          name: 'Bob',
          email: 'bob@example.com',
          date: '2026-10-20T10:00:00Z',
          timestamp: new Date('2026-10-20T10:00:00Z').getTime(),
        },
        additions: 15,
        deletions: 5,
        files: [
          { path: 'src/main.ts', status: 'modified', additions: 15, deletions: 5, changes: 20 },
        ],
      }),
    ];

    const mockProvider: IGitHistoryProvider = {
      getCommits: vi.fn().mockResolvedValue(mockCommits),
      getCommit: vi.fn().mockResolvedValue(mockCommits[0]),
    };

    const service = new GitService({ provider: mockProvider });
    const report = await service.analyzeRepositoryHistory('facebook', 'react', {
      branch: 'main',
      maxCommits: 50,
    });

    expect(report.repoId).toBe('facebook/react');
    expect(report.defaultBranch).toBe('main');
    expect(report.summary.totalCommitsAnalyzed).toBe(2);
    expect(report.summary.totalAdditions).toBe(45);
    expect(report.summary.totalDeletions).toBe(15);
    expect(report.summary.netGrowth).toBe(30);
    expect(report.summary.uniqueAuthorsCount).toBe(2);
    expect(report.summary.uniqueFilesChangedCount).toBe(2);
    expect(report.summary.firstCommitDate).toBe('2026-10-10T10:00:00.000Z');
    expect(report.summary.latestCommitDate).toBe('2026-10-20T10:00:00.000Z');
    expect(report.hotspots.length).toBe(2);
    expect(report.hotspots[0].path).toBe('src/main.ts');
    expect(report.hotspots[0].hotspotScore).toBe(100);
    expect(report.activityTimeline.length).toBeGreaterThan(0);
    expect(report.scoringFormula).toBe(HOTSPOT_FORMULA_DOCUMENTATION);
    expect(report.isSampled).toBe(false);
  });
});
