import { describe, it, expect } from 'vitest';
import {
  evaluateRepositoryHealth,
  evaluateCategory,
  getHealthRatingTier,
  HEALTH_CATEGORY_WEIGHTS,
  type HealthRuleContext,
} from '@/lib/analyzer/health';
import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import type { DependencyGraph } from '@/types/dependency';
import type { GitCommit } from '@/types/git';

function makeMockMetadata(overrides: Partial<RepositoryMetadata> = {}): RepositoryMetadata {
  return {
    owner: 'acme-corp',
    name: 'super-lib',
    fullName: 'acme-corp/super-lib',
    description: 'An awesome deterministic TypeScript library for modern web applications.',
    htmlUrl: 'https://github.com/acme-corp/super-lib',
    defaultBranch: 'main',
    visibility: 'public',
    isFork: false,
    isArchived: false,
    stars: 1200,
    forks: 150,
    openIssues: 12,
    watchers: 50,
    license: {
      key: 'mit',
      name: 'MIT License',
      spdxId: 'MIT',
      url: 'https://api.github.com/licenses/mit',
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
    pushedAt: new Date().toISOString(),
    language: 'TypeScript',
    topics: ['typescript', 'library', 'developer-tools'],
    homepage: 'https://super-lib.dev',
    sizeKb: 512,
    ...overrides,
  };
}

function makeMockTree(
  paths: Array<{ path: string; size?: number; type?: 'blob' | 'tree' }>
): RepositoryTree {
  const entries = paths.map((p) => ({
    path: p.path,
    name: p.path.split('/').pop() || p.path,
    type: p.type || 'blob',
    mode: '100644',
    size: p.size ?? 1024,
    sha: 'blob123',
    url: `https://api.github.com/repos/acme/repo/git/blobs/blob123`,
  }));

  return {
    sha: 'tree123',
    entries,
    truncated: false,
    totalFiles: entries.filter((e) => e.type === 'blob').length,
    totalDirectories: entries.filter((e) => e.type === 'tree').length,
    totalBytes: entries.reduce((sum, e) => sum + (e.size || 0), 0),
  };
}

function makeMockGraph(hasCycles = false): DependencyGraph {
  const nodes = new Map();
  nodes.set('src/index.ts', {
    filePath: 'src/index.ts',
    internalImports: ['src/utils.ts'],
    externalImports: ['lodash'],
    importedBy: [],
  });
  nodes.set('src/utils.ts', {
    filePath: 'src/utils.ts',
    internalImports: hasCycles ? ['src/index.ts'] : [],
    externalImports: [],
    importedBy: ['src/index.ts'],
  });

  return {
    nodes,
    edges: [],
    cycles: hasCycles
      ? [{ id: 'cycle-1', files: ['src/index.ts', 'src/utils.ts'], edgeIds: ['e1', 'e2'] }]
      : [],
    packages: [],
    stats: {
      totalFiles: 2,
      analyzedFiles: 2,
      internalEdges: hasCycles ? 2 : 1,
      externalEdges: 1,
      unresolvedEdges: 0,
      circularCyclesCount: hasCycles ? 1 : 0,
      uniquePackagesCount: 1,
      devPackagesCount: 0,
    },
  };
}

describe('Deterministic Repository Health Scoring Engine', () => {
  it('correctly classifies score tiers', () => {
    expect(getHealthRatingTier(95).tier).toBe('exemplary');
    expect(getHealthRatingTier(85).tier).toBe('exemplary');
    expect(getHealthRatingTier(84).tier).toBe('healthy');
    expect(getHealthRatingTier(70).tier).toBe('healthy');
    expect(getHealthRatingTier(69).tier).toBe('moderate');
    expect(getHealthRatingTier(50).tier).toBe('moderate');
    expect(getHealthRatingTier(49).tier).toBe('needs_attention');
    expect(getHealthRatingTier(10).tier).toBe('needs_attention');
  });

  it('guarantees weights sum to exactly 1.0 (100%)', () => {
    const totalWeight = Object.values(HEALTH_CATEGORY_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(Math.round(totalWeight * 100)).toBe(100);
  });

  it('evaluates an excellent repository with high exemplary score', () => {
    const metadata = makeMockMetadata();
    const tree = makeMockTree([
      { path: 'README.md', size: 2500 },
      { path: 'LICENSE', size: 1065 },
      { path: 'CONTRIBUTING.md', size: 1200 },
      { path: 'CODE_OF_CONDUCT.md', size: 1500 },
      { path: 'CHANGELOG.md', size: 3000 },
      { path: '.gitignore', size: 200 },
      { path: '.github/workflows/ci.yml', size: 600 },
      { path: '.github/ISSUE_TEMPLATE.md', size: 400 },
      { path: 'SECURITY.md', size: 800 },
      { path: 'package.json', size: 900 },
      { path: 'package-lock.json', size: 15000 },
      { path: 'vitest.config.ts', size: 300 },
      { path: 'src/index.ts', size: 1500 },
      { path: 'src/utils.ts', size: 1200 },
      { path: 'tests/index.test.ts', size: 1800 },
      { path: 'tests/utils.test.ts', size: 1400 },
    ]);
    const graph = makeMockGraph(false);
    const commits: GitCommit[] = [
      {
        sha: 'c1234567890abcdef',
        shortSha: 'c123456',
        message: 'fix: edge case',
        subject: 'fix: edge case',
        body: '',
        author: {
          name: 'Alice',
          email: 'alice@dev.io',
          date: new Date().toISOString(),
          timestamp: Date.now(),
        },
        committer: {
          name: 'Alice',
          email: 'alice@dev.io',
          date: new Date().toISOString(),
          timestamp: Date.now(),
        },
        files: [],
        additions: 10,
        deletions: 2,
        totalChanges: 12,
        parents: [],
        url: 'https://github.com/acme/super-lib/commit/c1',
      },
      {
        sha: 'c2234567890abcdef',
        shortSha: 'c223456',
        message: 'feat: new feature',
        subject: 'feat: new feature',
        body: '',
        author: {
          name: 'Bob',
          email: 'bob@dev.io',
          date: new Date().toISOString(),
          timestamp: Date.now(),
        },
        committer: {
          name: 'Bob',
          email: 'bob@dev.io',
          date: new Date().toISOString(),
          timestamp: Date.now(),
        },
        files: [],
        additions: 50,
        deletions: 10,
        totalChanges: 60,
        parents: [],
        url: 'https://github.com/acme/super-lib/commit/c2',
      },
    ];

    const report = evaluateRepositoryHealth({
      metadata,
      tree,
      graph,
      commits,
    });

    expect(report.overallScore).toBeGreaterThanOrEqual(85);
    expect(report.ratingTier).toBe('exemplary');
    expect(report.totalPositiveFindings).toBeGreaterThan(15);
    expect(report.categories.length).toBe(7);

    // Verify documentation score
    const docs = report.categories.find((c) => c.category === 'documentation');
    expect(docs).toBeDefined();
    expect(docs?.percentage).toBe(100);

    // Verify security score
    const sec = report.categories.find((c) => c.category === 'security');
    expect(sec).toBeDefined();
    expect(sec?.percentage).toBe(100);
  });

  it('guarantees 100% deterministic reproducibility', () => {
    const metadata = makeMockMetadata();
    const tree = makeMockTree([
      { path: 'README.md', size: 500 },
      { path: 'LICENSE', size: 500 },
      { path: 'index.js', size: 800 },
    ]);

    const context: HealthRuleContext = { metadata, tree };
    const run1 = evaluateRepositoryHealth(context);
    const run2 = evaluateRepositoryHealth(context);

    expect(run1.overallScore).toBe(run2.overallScore);
    expect(run1.ratingTier).toBe(run2.ratingTier);
    expect(run1.totalPositiveFindings).toBe(run2.totalPositiveFindings);
    expect(run1.totalNegativeFindings).toBe(run2.totalNegativeFindings);

    for (let i = 0; i < run1.categories.length; i++) {
      expect(run1.categories[i].score).toBe(run2.categories[i].score);
      expect(run1.categories[i].percentage).toBe(run2.categories[i].percentage);
    }
  });

  it('does NOT penalize minimal scripts without manifests for missing lockfiles', () => {
    const metadata = makeMockMetadata({ language: 'Python' });
    const tree = makeMockTree([
      { path: 'README.md', size: 800 },
      { path: 'LICENSE', size: 500 },
      { path: 'script.py', size: 1200 },
    ]);

    const report = evaluateRepositoryHealth({ metadata, tree });
    const depCategory = report.categories.find((c) => c.category === 'dependencies');

    expect(depCategory).toBeDefined();
    // Manifest and lockfile rules should be waived/neutral and not penalize the score
    const lockfileFinding = depCategory?.neutralFindings.find((f) => f.id === 'dep-lockfile');
    expect(lockfileFinding).toBeDefined();
    expect(lockfileFinding?.pointsAwarded).toBe(lockfileFinding?.maxPoints);
  });

  it('penalizes repositories with missing documentation', () => {
    const metadata = makeMockMetadata({
      description: null,
      license: null,
    });
    // Tree without README, LICENSE, etc.
    const tree = makeMockTree([{ path: 'main.go', size: 2000 }]);

    const docsScore = evaluateCategory('documentation', { metadata, tree });
    expect(docsScore.score).toBe(0);
    expect(docsScore.percentage).toBe(0);
    expect(docsScore.negativeFindings.length).toBeGreaterThanOrEqual(3);
  });

  it('penalizes inactive repositories with dormant commit history', () => {
    const twoYearsAgo = new Date(Date.now() - 800 * 24 * 60 * 60 * 1000).toISOString();
    const metadata = makeMockMetadata({
      pushedAt: twoYearsAgo,
      updatedAt: twoYearsAgo,
    });
    const tree = makeMockTree([{ path: 'README.md', size: 500 }]);

    const activityScore = evaluateCategory('activity', { metadata, tree, commits: [] });
    const recentActivity = activityScore.negativeFindings.find(
      (f) => f.id === 'activity-recent-window'
    );
    expect(recentActivity).toBeDefined();
    expect(recentActivity?.pointsAwarded).toBe(0);
  });

  it('penalizes repositories with circular imports and missing lockfiles', () => {
    const metadata = makeMockMetadata();
    const tree = makeMockTree([
      { path: 'package.json', size: 500 }, // manifest exists but NO lockfile
      { path: 'src/index.ts', size: 800 },
      { path: 'src/utils.ts', size: 800 },
    ]);
    const graph = makeMockGraph(true); // contains circular dependency

    const depScore = evaluateCategory('dependencies', { metadata, tree, graph });
    const cycleFinding = depScore.negativeFindings.find((f) => f.id === 'dep-cycle-free');
    expect(cycleFinding).toBeDefined();
    expect(cycleFinding?.pointsAwarded).toBe(10);

    const lockfileFinding = depScore.negativeFindings.find((f) => f.id === 'dep-lockfile');
    expect(lockfileFinding).toBeDefined();
    expect(lockfileFinding?.pointsAwarded).toBe(0);
  });

  it('detects committed secrets or private keys in the tree', () => {
    const metadata = makeMockMetadata();
    const tree = makeMockTree([
      { path: 'README.md', size: 500 },
      { path: 'id_rsa', size: 1600 },
      { path: '.env', size: 200 },
    ]);

    const secScore = evaluateCategory('security', { metadata, tree });
    const secretFinding = secScore.negativeFindings.find((f) => f.id === 'sec-no-secrets');
    expect(secretFinding).toBeDefined();
    expect(secretFinding?.pointsAwarded).toBe(0);
    expect(secretFinding?.explanation).toContain('credential/key naming conventions');
  });

  it('detects binary artifacts checked into source control', () => {
    const metadata = makeMockMetadata();
    const tree = makeMockTree([
      { path: 'README.md', size: 500 },
      { path: 'bin/app.exe', size: 2500000 },
      { path: 'lib/vendor.so', size: 1200000 },
    ]);

    const hygieneScore = evaluateCategory('hygiene', { metadata, tree });
    const binaryFinding = hygieneScore.negativeFindings.find(
      (f) => f.id === 'hygiene-no-binary-blobs'
    );
    expect(binaryFinding).toBeDefined();
    expect(binaryFinding?.pointsAwarded).toBe(0);
  });
});
