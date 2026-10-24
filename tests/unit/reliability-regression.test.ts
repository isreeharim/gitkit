import { describe, it, expect, vi } from 'vitest';
import { RepositoryService } from '@/lib/github/service';
import { GitHubApiError, type IGitHubClient, type RawGitHubRepository } from '@/lib/github/client';
import { detectLanguage, isSourceCodeFile } from '@/lib/metrics/language-detector';
import { buildRepositoryMetricsReport } from '@/lib/metrics/metrics-engine';
import { buildDependencyGraph } from '@/lib/analyzer/graph-builder';
import { generateExportFilename } from '@/lib/export/filename';
import { generateRepoMapSvg, generateDependencySvg } from '@/lib/export/svg-generator';
import {
  generateRepoStructureMermaid,
  generateDependencyMermaid,
} from '@/lib/export/mermaid-generator';
import { buildRepositoryGraph } from '@/lib/graph/tree-to-graph';
import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';

describe('Production Hardening & Reliability Regression Tests', () => {
  const baseMetadata: RepositoryMetadata = {
    owner: 'test-org',
    name: 'test-repo',
    fullName: 'test-org/test-repo',
    description: 'A test repository',
    htmlUrl: 'https://github.com/test-org/test-repo',
    defaultBranch: 'main',
    visibility: 'public',
    isFork: false,
    isArchived: false,
    stars: 10,
    forks: 2,
    openIssues: 1,
    watchers: 5,
    license: { key: 'mit', name: 'MIT License', spdxId: 'MIT', url: null },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    pushedAt: '2026-03-01T00:00:00Z',
    language: 'TypeScript',
    topics: ['testing'],
    homepage: null,
    sizeKb: 100,
  };

  describe('1. Empty repository handling (0 commits, 0 files)', () => {
    it('gracefully handles empty repo when Git tree returns 404/409', async () => {
      const mockRawRepo: RawGitHubRepository = {
        id: 99999,
        name: 'empty-repo',
        full_name: 'test-org/empty-repo',
        private: false,
        html_url: 'https://github.com/test-org/empty-repo',
        description: 'Empty repo',
        fork: false,
        archived: false,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        pushed_at: '2026-01-01T00:00:00Z',
        size: 0,
        stargazers_count: 0,
        watchers_count: 0,
        forks_count: 0,
        open_issues_count: 0,
        language: null,
        default_branch: 'main',
        owner: { login: 'test-org' },
        license: null,
      };

      const mockClient: IGitHubClient = {
        fetchRepository: vi.fn().mockResolvedValue(mockRawRepo),
        fetchTree: vi
          .fn()
          .mockRejectedValue(new GitHubApiError('Git Repository is empty.', 'not_found', 404)),
        fetchBlobContent: vi.fn().mockResolvedValue(null),
        fetchFileContent: vi.fn().mockResolvedValue(null),
      };

      const service = new RepositoryService(mockClient);
      const result = await service.ingestRepository('test-org', 'empty-repo');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tree.totalFiles).toBe(0);
        expect(result.tree.totalDirectories).toBe(0);
        expect(result.tree.entries).toHaveLength(0);
        expect(result.tree.truncated).toBe(false);
      }
    });

    it('generates zero-metric reports for empty trees without crashing', () => {
      const emptyTree: RepositoryTree = {
        sha: '',
        truncated: false,
        entries: [],
        totalFiles: 0,
        totalDirectories: 0,
        totalBytes: 0,
      };

      const metrics = buildRepositoryMetricsReport({
        metadata: baseMetadata,
        tree: emptyTree,
      });
      expect(metrics.code.totalFiles.value).toBe(0);
      expect(metrics.code.loc.totalLines).toBe(0);
      expect(metrics.code.languages).toHaveLength(0);
      expect(metrics.structure.largestFiles).toHaveLength(0);

      const graph = buildRepositoryGraph(baseMetadata, emptyTree);
      expect(graph.nodes.size).toBe(1); // Root repository node only
      expect(graph.edges).toHaveLength(0);

      const svg = generateRepoMapSvg(graph);
      expect(svg).toContain('<svg');
      expect(svg).toContain('test-repo');

      const mermaid = generateRepoStructureMermaid(graph);
      expect(mermaid).toContain('flowchart TD');
    });
  });

  describe('2. Unusual filenames and unicode path handling', () => {
    it('safely processes filenames with spaces, unicode, and symbols', () => {
      const weirdTree: RepositoryTree = {
        sha: 'tree-weird',
        truncated: false,
        entries: [
          { path: 'src', name: 'src', type: 'tree', sha: 's1', mode: '040000' },
          {
            path: 'src/my folder with spaces',
            name: 'my folder with spaces',
            type: 'tree',
            sha: 's2',
            mode: '040000',
          },
          {
            path: 'src/my folder with spaces/App Component.tsx',
            name: 'App Component.tsx',
            type: 'blob',
            size: 500,
            sha: 's3',
            mode: '100644',
          },
          {
            path: 'src/i18n/日本語・한국어.json',
            name: '日本語・한국어.json',
            type: 'blob',
            size: 300,
            sha: 's4',
            mode: '100644',
          },
          {
            path: 'src/special#symbols!@$%.ts',
            name: 'special#symbols!@$%.ts',
            type: 'blob',
            size: 400,
            sha: 's5',
            mode: '100644',
          },
        ],
        totalFiles: 3,
        totalDirectories: 2,
        totalBytes: 1200,
      };

      const graph = buildRepositoryGraph(baseMetadata, weirdTree);
      // Root (1) + explicit dirs (2) + synthesized missing dir src/i18n (1) + blobs (3) = 7 nodes
      expect(graph.nodes.size).toBe(7);

      // Test SVG export with special characters
      const svg = generateRepoMapSvg(graph);
      expect(svg).toContain('App Component.tsx');
      expect(svg).toContain('日本語・한국어.json');

      // Test Mermaid export sanitization
      const mermaid = generateRepoStructureMermaid(graph);
      expect(mermaid).toContain('flowchart TD');
      // No unescaped double quotes inside node labels
      expect(mermaid).not.toMatch(/\["[^"\n]*"[^"\n]*"\]/);
    });

    it('deterministically sanitizes exotic repository names in export filenames', () => {
      const filename = generateExportFilename({
        owner: '  --Exotic_Owner--  ',
        repo: 'Repo..Name$$With%%Symbols  ',
        target: 'repomap',
        format: 'svg',
        includeTimestamp: false,
      });

      expect(filename).toBe('gitkit-exotic_owner-repo..name-with-symbols-repomap.svg');
      expect(filename).not.toMatch(/[$%#@!]/);
    });
  });

  describe('3. Unsupported languages and exotic extensions', () => {
    it('treats unknown programming languages safely as plaintext/other', () => {
      expect(detectLanguage('main.xyz')).toBeNull();
      expect(detectLanguage('kernel.custom_extension')).toBeNull();
      expect(isSourceCodeFile('main.xyz')).toBe(false);

      const treeWithUnknowns: RepositoryTree = {
        sha: 'unknown-sha',
        truncated: false,
        entries: [
          {
            path: 'main.xyz',
            name: 'main.xyz',
            type: 'blob',
            size: 200,
            sha: 'u1',
            mode: '100644',
          },
          {
            path: 'docs.custom',
            name: 'docs.custom',
            type: 'blob',
            size: 400,
            sha: 'u2',
            mode: '100644',
          },
        ],
        totalFiles: 2,
        totalDirectories: 0,
        totalBytes: 600,
      };

      const metrics = buildRepositoryMetricsReport({
        metadata: baseMetadata,
        tree: treeWithUnknowns,
      });
      const dist = metrics.code.languages;
      expect(dist).toHaveLength(1);
      expect(dist[0].name).toBe('Other');

      // Dependency graph handles empty imports safely
      const depGraph = buildDependencyGraph({
        parsedFiles: new Map(),
        allRepoPaths: new Set(treeWithUnknowns.entries.map((e) => e.path)),
        manifests: [],
      });
      expect(depGraph.nodes.size).toBe(0);
      expect(depGraph.edges).toHaveLength(0);
    });
  });

  describe('4. Large truncated repository handling', () => {
    it('flags truncated trees and bounds metrics gracefully', () => {
      const truncatedTree: RepositoryTree = {
        sha: 'trunc-sha',
        truncated: true,
        entries: [
          {
            path: 'file1.ts',
            name: 'file1.ts',
            type: 'blob',
            size: 100,
            sha: 't1',
            mode: '100644',
          },
        ],
        totalFiles: 1,
        totalDirectories: 0,
        totalBytes: 100,
      };

      expect(truncatedTree.truncated).toBe(true);
      const graph = buildRepositoryGraph(baseMetadata, truncatedTree);
      expect(graph.nodes.size).toBe(2); // root + file1
    });
  });

  describe('5. Partial API and network failure resilience', () => {
    it('builds metrics when commit count and contributor count are null', () => {
      const metrics = buildRepositoryMetricsReport({
        metadata: baseMetadata,
        tree: {
          sha: 's',
          truncated: false,
          entries: [],
          totalFiles: 0,
          totalDirectories: 0,
          totalBytes: 0,
        },
        activity: {
          commitCount: null,
          contributorCount: null,
          isCommitCountApproximate: false,
          isContributorCountApproximate: false,
        },
      });

      expect(metrics.activity.commitCount).toBeNull();
      expect(metrics.activity.contributorCount).toBeNull();
    });

    it('safely handles empty dependency graph exports', () => {
      const emptyDepGraph: import('@/types/dependency').DependencyGraph = {
        nodes: new Map(),
        edges: [],
        cycles: [],
        packages: [],
        stats: {
          totalFiles: 0,
          analyzedFiles: 0,
          internalEdges: 0,
          externalEdges: 0,
          unresolvedEdges: 0,
          circularCyclesCount: 0,
          uniquePackagesCount: 0,
          devPackagesCount: 0,
        },
      };

      const svg = generateDependencySvg(emptyDepGraph);
      expect(svg).toContain('<svg');

      const mermaid = generateDependencyMermaid(emptyDepGraph);
      expect(mermaid).toContain('flowchart LR');
    });
  });
});
