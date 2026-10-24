import { describe, it, expect, vi } from 'vitest';
import {
  normalizePullRequestSummary,
  normalizePullRequestDetail,
  normalizePullRequestFileStatus,
  analyzePullRequestImpact,
  PullRequestService,
  PR_IMPACT_DISCLAIMER,
  type RawPullRequestItem,
  type RawPullRequestFileItem,
} from '@/lib/pulls';
import type { DependencyGraph } from '@/types/dependency';
import type { IGitHubClient } from '@/lib/github/client';

function makeMockRawPr(overrides: Partial<RawPullRequestItem> = {}): RawPullRequestItem {
  return {
    number: 42,
    title: 'feat: add awesome feature',
    body: 'Detailed description of the PR.',
    state: 'open',
    draft: false,
    user: {
      login: 'alice-dev',
      avatar_url: 'https://avatars.github.com/u/101',
      html_url: 'https://github.com/alice-dev',
    },
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-21T12:00:00Z',
    closed_at: null,
    merged_at: null,
    head: {
      ref: 'feature-branch',
      sha: 'head123456',
    },
    base: {
      ref: 'main',
      sha: 'base123456',
    },
    html_url: 'https://github.com/owner/repo/pull/42',
    additions: 150,
    deletions: 30,
    changed_files: 3,
    commits: 2,
    ...overrides,
  };
}

describe('Pull Request Normalizer', () => {
  it('normalizes file change status strings', () => {
    expect(normalizePullRequestFileStatus('added')).toBe('added');
    expect(normalizePullRequestFileStatus('modified')).toBe('modified');
    expect(normalizePullRequestFileStatus('removed')).toBe('removed');
    expect(normalizePullRequestFileStatus('renamed')).toBe('renamed');
    expect(normalizePullRequestFileStatus('CHANGED')).toBe('modified');
  });

  it('normalizes an open pull request summary correctly', () => {
    const raw = makeMockRawPr();
    const normalized = normalizePullRequestSummary(raw);

    expect(normalized.number).toBe(42);
    expect(normalized.title).toBe('feat: add awesome feature');
    expect(normalized.state).toBe('open');
    expect(normalized.isDraft).toBe(false);
    expect(normalized.author.username).toBe('alice-dev');
    expect(normalized.headBranch).toBe('feature-branch');
    expect(normalized.baseBranch).toBe('main');
    expect(normalized.additions).toBe(150);
    expect(normalized.deletions).toBe(30);
    expect(normalized.totalChanges).toBe(180);
  });

  it('classifies merged pull requests when merged_at timestamp is present', () => {
    const raw = makeMockRawPr({
      state: 'closed',
      merged_at: '2026-10-22T15:00:00Z',
      closed_at: '2026-10-22T15:00:00Z',
    });
    const normalized = normalizePullRequestSummary(raw);

    expect(normalized.state).toBe('merged');
    expect(normalized.mergedAt).toBe('2026-10-22T15:00:00Z');
  });

  it('classifies closed unmerged pull requests correctly', () => {
    const raw = makeMockRawPr({
      state: 'closed',
      merged_at: null,
      closed_at: '2026-10-22T15:00:00Z',
    });
    const normalized = normalizePullRequestSummary(raw);

    expect(normalized.state).toBe('closed');
    expect(normalized.mergedAt).toBeNull();
  });

  it('normalizes detailed PR with changed files and calculates aggregates', () => {
    const rawPr = makeMockRawPr({ additions: 0, deletions: 0 });
    const rawFiles: RawPullRequestFileItem[] = [
      {
        filename: 'src/components/Header.tsx',
        status: 'modified',
        additions: 40,
        deletions: 10,
        changes: 50,
      },
      {
        filename: 'src/lib/api.ts',
        status: 'added',
        additions: 100,
        deletions: 0,
        changes: 100,
      },
    ];

    const detail = normalizePullRequestDetail(rawPr, rawFiles);

    expect(detail.files).toHaveLength(2);
    expect(detail.additions).toBe(140);
    expect(detail.deletions).toBe(10);
    expect(detail.totalChanges).toBe(150);
    expect(detail.changedFilesCount).toBe(2);
    expect(detail.files[0].path).toBe('src/components/Header.tsx');
    expect(detail.files[0].status).toBe('modified');
  });
});

describe('Pull Request Impact Analyzer', () => {
  it('handles empty changed files gracefully', () => {
    const pr = normalizePullRequestDetail(makeMockRawPr(), []);
    const report = analyzePullRequestImpact('owner/repo', pr);

    expect(report.totalFilesChanged).toBe(0);
    expect(report.totalAdditions).toBe(0);
    expect(report.totalDeletions).toBe(0);
    expect(report.affectedDirectories).toEqual([]);
    expect(report.affectedModules).toEqual([]);
    expect(report.disclaimer).toBe(PR_IMPACT_DISCLAIMER);
  });

  it('calculates directory change concentration and largest changed files', () => {
    const rawFiles: RawPullRequestFileItem[] = [
      {
        filename: 'src/components/Nav.tsx',
        status: 'modified',
        additions: 20,
        deletions: 5,
        changes: 25,
      },
      {
        filename: 'src/components/Button.tsx',
        status: 'added',
        additions: 50,
        deletions: 0,
        changes: 50,
      },
      {
        filename: 'docs/architecture.md',
        status: 'modified',
        additions: 10,
        deletions: 2,
        changes: 12,
      },
    ];

    const pr = normalizePullRequestDetail(makeMockRawPr(), rawFiles);
    const report = analyzePullRequestImpact('owner/repo', pr);

    expect(report.totalFilesChanged).toBe(3);
    expect(report.totalAdditions).toBe(80);
    expect(report.totalDeletions).toBe(7);
    expect(report.netGrowth).toBe(73);

    // Directory concentration
    expect(report.affectedDirectories).toHaveLength(2);
    const topDir = report.affectedDirectories[0];
    expect(topDir.directory).toBe('src/components');
    expect(topDir.changedFilesCount).toBe(2);
    expect(topDir.totalChanges).toBe(75);
    expect(topDir.percentageOfChanges).toBe(Math.round((75 / 87) * 100)); // ~86%

    expect(report.changeConcentration.topDirectory).toBe('src/components');
    expect(report.changeConcentration.fileTypeDistribution['.tsx']).toBe(2);
    expect(report.changeConcentration.fileTypeDistribution['.md']).toBe(1);

    // Largest files
    expect(report.largestChangedFiles[0].path).toBe('src/components/Button.tsx');
    expect(report.largestChangedFiles[0].changes).toBe(50);
  });

  it('traverses dependency graph to find direct and transitive dependents deterministically', () => {
    const rawFiles: RawPullRequestFileItem[] = [
      {
        filename: 'src/lib/core.ts',
        status: 'modified',
        additions: 30,
        deletions: 5,
        changes: 35,
      },
    ];

    const pr = normalizePullRequestDetail(makeMockRawPr(), rawFiles);

    // Mock dependency graph:
    // src/lib/core.ts imports "react" (external)
    // src/services/user.ts imports src/lib/core.ts (direct dependent, depth 1)
    // src/pages/dashboard.ts imports src/services/user.ts (transitive dependent, depth 2)
    const mockGraph: DependencyGraph = {
      nodes: new Map(),
      edges: [
        {
          id: 'e1',
          sourceFile: 'src/lib/core.ts',
          rawSpecifier: 'react',
          target: 'pkg:react',
          kind: 'external',
          importedSymbols: [],
          isTypeOnly: false,
          isDynamic: false,
          line: 1,
        },
        {
          id: 'e2',
          sourceFile: 'src/services/user.ts',
          rawSpecifier: '@/lib/core',
          target: 'src/lib/core.ts',
          kind: 'internal',
          importedSymbols: [],
          isTypeOnly: false,
          isDynamic: false,
          line: 1,
        },
        {
          id: 'e3',
          sourceFile: 'src/pages/dashboard.ts',
          rawSpecifier: '@/services/user',
          target: 'src/services/user.ts',
          kind: 'internal',
          importedSymbols: [],
          isTypeOnly: false,
          isDynamic: false,
          line: 1,
        },
      ],
      cycles: [],
      packages: [],
      stats: {
        totalFiles: 3,
        analyzedFiles: 3,
        internalEdges: 2,
        externalEdges: 1,
        unresolvedEdges: 0,
        circularCyclesCount: 0,
        uniquePackagesCount: 1,
        devPackagesCount: 0,
      },
    };

    const report = analyzePullRequestImpact('owner/repo', pr, mockGraph);

    // Direct dependencies of core.ts
    expect(report.directDependencies).toEqual(['pkg:react']);

    // Downstream affected modules
    expect(report.affectedModules).toHaveLength(3);

    // Depth 0: modified file
    expect(report.affectedModules[0].path).toBe('src/lib/core.ts');
    expect(report.affectedModules[0].depth).toBe(0);
    expect(report.affectedModules[0].isDirectlyChanged).toBe(true);

    // Depth 1: direct dependent
    expect(report.affectedModules[1].path).toBe('src/services/user.ts');
    expect(report.affectedModules[1].depth).toBe(1);
    expect(report.affectedModules[1].isDirectlyChanged).toBe(false);

    // Depth 2: transitive dependent
    expect(report.affectedModules[2].path).toBe('src/pages/dashboard.ts');
    expect(report.affectedModules[2].depth).toBe(2);
    expect(report.affectedModules[2].isDirectlyChanged).toBe(false);

    // Total affected count
    expect(report.totalAffectedModulesCount).toBe(3);
  });

  it('prevents infinite loops when dependency graph contains circular imports', () => {
    const rawFiles: RawPullRequestFileItem[] = [
      {
        filename: 'src/a.ts',
        status: 'modified',
        additions: 10,
        deletions: 2,
        changes: 12,
      },
    ];

    const pr = normalizePullRequestDetail(makeMockRawPr(), rawFiles);

    // Circular graph: A -> B -> C -> A
    const circularGraph: DependencyGraph = {
      nodes: new Map(),
      edges: [
        {
          id: 'e1',
          sourceFile: 'src/b.ts',
          rawSpecifier: './a',
          target: 'src/a.ts',
          kind: 'internal',
          importedSymbols: [],
          isTypeOnly: false,
          isDynamic: false,
          line: 1,
        },
        {
          id: 'e2',
          sourceFile: 'src/c.ts',
          rawSpecifier: './b',
          target: 'src/b.ts',
          kind: 'internal',
          importedSymbols: [],
          isTypeOnly: false,
          isDynamic: false,
          line: 1,
        },
        {
          id: 'e3',
          sourceFile: 'src/a.ts',
          rawSpecifier: './c',
          target: 'src/c.ts',
          kind: 'internal',
          importedSymbols: [],
          isTypeOnly: false,
          isDynamic: false,
          line: 1,
        },
      ],
      cycles: [
        {
          id: 'c1',
          files: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts'],
          edgeIds: ['e1', 'e2', 'e3'],
        },
      ],
      packages: [],
      stats: {
        totalFiles: 3,
        analyzedFiles: 3,
        internalEdges: 3,
        externalEdges: 0,
        unresolvedEdges: 0,
        circularCyclesCount: 1,
        uniquePackagesCount: 0,
        devPackagesCount: 0,
      },
    };

    const report = analyzePullRequestImpact('owner/repo', pr, circularGraph);

    // Each module should only appear once despite the cycle
    const paths = report.affectedModules.map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(report.affectedModules.length).toBe(3);
  });
});

describe('PullRequestService', () => {
  it('retrieves and normalizes pull request list', async () => {
    const mockClient: IGitHubClient = {
      fetchRepository: vi.fn(),
      fetchTree: vi.fn(),
      fetchFileContent: vi.fn(),
      fetchBlobContent: vi.fn(),
      fetchPullRequests: vi
        .fn()
        .mockResolvedValue([makeMockRawPr({ number: 101, title: 'fix: patch bug' })]),
    };

    const service = new PullRequestService({ client: mockClient });
    const list = await service.getPullRequests('owner', 'repo');

    expect(list).toHaveLength(1);
    expect(list[0].number).toBe(101);
    expect(list[0].title).toBe('fix: patch bug');
  });

  it('returns null when pull request does not exist', async () => {
    const mockClient: IGitHubClient = {
      fetchRepository: vi.fn(),
      fetchTree: vi.fn(),
      fetchFileContent: vi.fn(),
      fetchBlobContent: vi.fn(),
      fetchPullRequest: vi.fn().mockResolvedValue(null),
      fetchPullRequestFiles: vi.fn().mockResolvedValue([]),
    };

    const service = new PullRequestService({ client: mockClient });
    const detail = await service.getPullRequestDetail('owner', 'repo', 999);
    expect(detail).toBeNull();

    const analysis = await service.analyzePullRequest('owner', 'repo', 999);
    expect(analysis).toBeNull();
  });
});
