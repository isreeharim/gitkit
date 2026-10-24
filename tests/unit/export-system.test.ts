import { describe, it, expect } from 'vitest';
import type { RepositoryMetadata } from '@/types/repository';
import type { RepoGraph, RepoGraphNode } from '@/lib/graph/graph-model';
import type { DependencyGraph } from '@/types/dependency';
import { generateExportFilename, getFormatExtension } from '@/lib/export/filename';
import { generateRepoMapSvg, generateDependencySvg } from '@/lib/export/svg-generator';
import {
  generateRepoStructureMermaid,
  generateDependencyMermaid,
} from '@/lib/export/mermaid-generator';
import { generateExportPayload, generateExportJson } from '@/lib/export/json-generator';

const MOCK_METADATA: RepositoryMetadata = {
  owner: 'octocat',
  name: 'Hello-World',
  fullName: 'octocat/Hello-World',
  description: 'My first repository on GitHub!',
  htmlUrl: 'https://github.com/octocat/Hello-World',
  defaultBranch: 'main',
  visibility: 'public',
  stars: 1842,
  forks: 412,
  watchers: 95,
  openIssues: 12,
  sizeKb: 1024,
  license: {
    key: 'mit',
    name: 'MIT License',
    spdxId: 'MIT',
    url: null,
  },
  language: 'TypeScript',
  topics: ['git', 'demo'],
  homepage: null,
  isArchived: false,
  isFork: false,
  createdAt: '2020-01-01T00:00:00Z',
  updatedAt: '2026-10-24T12:00:00Z',
  pushedAt: '2026-10-24T12:00:00Z',
};

function createMockRepoGraph(): RepoGraph {
  const nodes = new Map<string, RepoGraphNode>();

  nodes.set('repo-root', {
    id: 'repo-root',
    type: 'repository',
    name: 'octocat/Hello-World',
    path: '',
    depth: 0,
    parentId: null,
    childIds: ['dir-src', 'file-readme'],
    owner: 'octocat',
    repo: 'Hello-World',
    defaultBranch: 'main',
    totalFiles: 3,
    totalDirectories: 1,
    totalBytes: 5200,
    stars: 1842,
    language: 'TypeScript',
  });

  nodes.set('dir-src', {
    id: 'dir-src',
    type: 'directory',
    name: 'src',
    path: 'src',
    depth: 1,
    parentId: 'repo-root',
    childIds: ['file-index', 'file-utils'],
    childFileCount: 2,
    childDirectoryCount: 0,
    totalDescendantFiles: 2,
    totalDescendantBytes: 4200,
  });

  nodes.set('file-readme', {
    id: 'file-readme',
    type: 'file',
    name: 'README.md',
    path: 'README.md',
    depth: 1,
    parentId: 'repo-root',
    childIds: [],
    size: 1000,
    extension: 'md',
    sha: 'sha-readme',
  });

  nodes.set('file-index', {
    id: 'file-index',
    type: 'file',
    name: 'index.ts',
    path: 'src/index.ts',
    depth: 2,
    parentId: 'dir-src',
    childIds: [],
    size: 2200,
    extension: 'ts',
    sha: 'sha-index',
  });

  nodes.set('file-utils', {
    id: 'file-utils',
    type: 'file',
    name: 'utils.ts',
    path: 'src/utils.ts',
    depth: 2,
    parentId: 'dir-src',
    childIds: [],
    size: 2000,
    extension: 'ts',
    sha: 'sha-utils',
  });

  const edges = [
    { id: 'edge-root-src', source: 'repo-root', target: 'dir-src', type: 'CONTAINS' as const },
    {
      id: 'edge-root-readme',
      source: 'repo-root',
      target: 'file-readme',
      type: 'CONTAINS' as const,
    },
    { id: 'edge-src-index', source: 'dir-src', target: 'file-index', type: 'CONTAINS' as const },
    { id: 'edge-src-utils', source: 'dir-src', target: 'file-utils', type: 'CONTAINS' as const },
  ];

  const adjacencyList = new Map<string, string[]>([
    ['repo-root', ['dir-src', 'file-readme']],
    ['dir-src', ['file-index', 'file-utils']],
    ['file-readme', []],
    ['file-index', []],
    ['file-utils', []],
  ]);

  return {
    rootId: 'repo-root',
    nodes,
    edges,
    adjacencyList,
  };
}

function createMockDependencyGraph(): DependencyGraph {
  const nodes = new Map();

  nodes.set('src/index.ts', {
    id: 'src/index.ts',
    type: 'file',
    name: 'index.ts',
    path: 'src/index.ts',
    language: 'typescript',
    isAnalyzed: true,
    inDegree: 0,
    outDegree: 2,
    inCycle: false,
    cycleIds: [],
  });

  nodes.set('src/utils.ts', {
    id: 'src/utils.ts',
    type: 'file',
    name: 'utils.ts',
    path: 'src/utils.ts',
    language: 'typescript',
    isAnalyzed: true,
    inDegree: 1,
    outDegree: 0,
    inCycle: false,
    cycleIds: [],
  });

  nodes.set('pkg:npm/react', {
    id: 'pkg:npm/react',
    type: 'package',
    name: 'react',
    ecosystem: 'npm',
    versionConstraint: '^19.0.0',
    isDev: false,
    manifestSource: 'package.json',
  });

  const edges = [
    {
      id: 'dep-1',
      sourceFile: 'src/index.ts',
      rawSpecifier: './utils',
      target: 'src/utils.ts',
      kind: 'internal' as const,
      importedSymbols: ['formatText'],
      isTypeOnly: false,
      isDynamic: false,
      line: 2,
    },
    {
      id: 'dep-2',
      sourceFile: 'src/index.ts',
      rawSpecifier: 'react',
      target: 'pkg:npm/react',
      kind: 'external' as const,
      importedSymbols: ['useState'],
      isTypeOnly: false,
      isDynamic: false,
      line: 1,
    },
  ];

  return {
    nodes,
    edges,
    cycles: [],
    packages: [
      {
        name: 'react',
        versionConstraint: '^19.0.0',
        isDev: false,
        manifestSource: 'package.json',
        ecosystem: 'npm',
      },
    ],
    stats: {
      totalFiles: 2,
      analyzedFiles: 2,
      internalEdges: 1,
      externalEdges: 1,
      unresolvedEdges: 0,
      circularCyclesCount: 0,
      uniquePackagesCount: 1,
      devPackagesCount: 0,
    },
  };
}

describe('GitKit Export Filename Generator', () => {
  it('generates standard extensions for each export format', () => {
    expect(getFormatExtension('svg')).toBe('svg');
    expect(getFormatExtension('png')).toBe('png');
    expect(getFormatExtension('mermaid')).toBe('mmd');
    expect(getFormatExtension('json')).toBe('json');
  });

  it('generates deterministic filenames without timestamp by default', () => {
    const filename = generateExportFilename({
      owner: 'octocat',
      repo: 'Hello-World',
      target: 'repomap',
      format: 'svg',
    });
    expect(filename).toBe('gitkit-octocat-hello-world-repomap.svg');
  });

  it('sanitizes special characters in owner and repo coordinates', () => {
    const filename = generateExportFilename({
      owner: 'My Company!',
      repo: 'Special.Project#1',
      target: 'dependencies',
      format: 'mermaid',
    });
    expect(filename).toBe('gitkit-my-company-special.project-1-dependencies.mmd');
  });

  it('appends deterministic timestamp when requested', () => {
    const filename = generateExportFilename({
      owner: 'octocat',
      repo: 'Hello-World',
      target: 'bundle',
      format: 'json',
      includeTimestamp: true,
      timestamp: '2026-10-24T12:00:00Z',
    });
    expect(filename).toBe('gitkit-octocat-hello-world-bundle-20261024.json');
  });
});

describe('Deterministic SVG Generator', () => {
  it('generates valid standalone SVG for Repo Map with XML namespace and viewBox', () => {
    const graph = createMockRepoGraph();
    const svg = generateRepoMapSvg(graph, { title: 'Test Repo Map' });

    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
    expect(svg).toContain('</svg>');

    // Check header and node contents
    expect(svg).toContain('Test Repo Map');
    expect(svg).toContain('octocat/Hello-World');
    expect(svg).toContain('src');
    expect(svg).toContain('README.md');
    expect(svg).toContain('index.ts');
    expect(svg).toContain('utils.ts');

    // Check connector edges
    expect(svg).toContain('<path d="M');
    expect(svg).toContain('marker-end="url(#arrow)"');
  });

  it('generates valid standalone SVG for Dependency Graph', () => {
    const graph = createMockDependencyGraph();
    const svg = generateDependencySvg(graph, { title: 'Test Dependency Graph' });

    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('</svg>');

    expect(svg).toContain('Test Dependency Graph');
    expect(svg).toContain('src/index.ts');
    expect(svg).toContain('src/utils.ts');
    expect(svg).toContain('react');
    expect(svg).toContain('PKG');

    // Check external edge dashed style
    expect(svg).toContain('stroke-dasharray="4,4"');
  });

  it('escapes XML special characters safely', () => {
    const graph = createMockRepoGraph();
    const svg = generateRepoMapSvg(graph, { title: 'Repo & "Special" <Chars>' });

    expect(svg).toContain('Repo &amp; &quot;Special&quot; &lt;Chars&gt;');
    expect(svg).not.toContain('Repo & "Special" <Chars>');
  });

  it('guarantees byte-for-byte identical SVG outputs for identical inputs', () => {
    const graph = createMockRepoGraph();
    const svg1 = generateRepoMapSvg(graph);
    const svg2 = generateRepoMapSvg(graph);

    expect(svg1).toBe(svg2);
  });
});

describe('Deterministic Mermaid Generator', () => {
  it('generates valid flowchart TD syntax for repository structure', () => {
    const graph = createMockRepoGraph();
    const mermaid = generateRepoStructureMermaid(graph);

    expect(mermaid.startsWith('flowchart TD')).toBe(true);
    expect(mermaid).toContain('n_repo_root["📦 octocat/Hello-World (main)"]');
    expect(mermaid).toContain('n_dir_src["📁 src/"]');
    expect(mermaid).toContain('n_file_readme["📄 README.md"]');
    expect(mermaid).toContain('n_file_index["📄 index.ts"]');

    // Check hierarchy connections
    expect(mermaid).toContain('n_repo_root --> n_dir_src');
    expect(mermaid).toContain('n_repo_root --> n_file_readme');
    expect(mermaid).toContain('n_dir_src --> n_file_index');

    // Check classDef styling
    expect(mermaid).toContain('classDef repo fill:#1e3a8a');
    expect(mermaid).toContain('classDef dir fill:#064e3b');
    expect(mermaid).toContain('classDef file fill:#18181b');
  });

  it('generates valid flowchart LR syntax for dependency graph', () => {
    const graph = createMockDependencyGraph();
    const mermaid = generateDependencyMermaid(graph);

    expect(mermaid.startsWith('flowchart LR')).toBe(true);
    expect(mermaid).toContain('n_src_index_ts["📄 src/index.ts"]');
    expect(mermaid).toContain('n_src_utils_ts["📄 src/utils.ts"]');
    expect(mermaid).toContain('n_pkg_npm_react[["📦 react (npm)"]]');

    // Check edge syntax
    expect(mermaid).toContain('n_src_index_ts -->|imports| n_src_utils_ts');
    expect(mermaid).toContain('n_src_index_ts -.->|depends on| n_pkg_npm_react');
  });

  it('filters out external packages when requested', () => {
    const graph = createMockDependencyGraph();
    const mermaid = generateDependencyMermaid(graph, { includeExternal: false });

    expect(mermaid).not.toContain('react');
    expect(mermaid).toContain('n_src_index_ts -->|imports| n_src_utils_ts');
  });

  it('guarantees deterministic identical output for identical graphs', () => {
    const graph = createMockDependencyGraph();
    const m1 = generateDependencyMermaid(graph);
    const m2 = generateDependencyMermaid(graph);

    expect(m1).toBe(m2);
  });
});

describe('Versioned GitKit JSON Export Schema (v1.0)', () => {
  it('generates normalized payload adhering to Schema v1.0', () => {
    const repoGraph = createMockRepoGraph();
    const depGraph = createMockDependencyGraph();

    const payload = generateExportPayload({
      metadata: MOCK_METADATA,
      repoGraph,
      dependencyGraph: depGraph,
      exportedAt: '2026-10-24T15:00:00.000Z',
    });

    expect(payload.version).toBe('1.0');
    expect(payload.schema).toBe('https://gitkit.in/schemas/v1.0/export.json');
    expect(payload.generator).toBe('GitKit 0.1.0');
    expect(payload.exportedAt).toBe('2026-10-24T15:00:00.000Z');

    // Repository metadata
    expect(payload.repository.owner).toBe('octocat');
    expect(payload.repository.name).toBe('Hello-World');
    expect(payload.repository.stars).toBe(1842);

    // RepoMap
    expect(payload.repoMap).toBeDefined();
    expect(payload.repoMap?.totalNodes).toBe(5);
    expect(payload.repoMap?.totalEdges).toBe(4);

    // Dependencies
    expect(payload.dependencies).toBeDefined();
    expect(payload.dependencies?.internalModulesCount).toBe(2);
    expect(payload.dependencies?.externalPackagesCount).toBe(1);
    expect(payload.dependencies?.hasCycles).toBe(false);
  });

  it('serializes formatted JSON string correctly', () => {
    const jsonString = generateExportJson({
      metadata: MOCK_METADATA,
      exportedAt: '2026-10-24T15:00:00.000Z',
    });

    const parsed = JSON.parse(jsonString);
    expect(parsed.version).toBe('1.0');
    expect(parsed.repository.owner).toBe('octocat');
    expect(jsonString).toContain('  "version": "1.0"'); // 2-space indentation
  });
});
