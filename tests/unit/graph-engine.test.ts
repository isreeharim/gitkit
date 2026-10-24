import { describe, it, expect } from 'vitest';
import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import { buildRepositoryGraph } from '@/lib/graph/tree-to-graph';
import {
  getInitialCollapsedDirectoryIds,
  toggleDirectoryCollapse,
  expandAllDirectories,
  collapseAllDirectories,
  getVisibleGraph,
} from '@/lib/graph/graph-collapse';
import { filterGraph, getAvailableExtensions } from '@/lib/graph/graph-filter';
import { computeHierarchicalLayout } from '@/lib/graph/graph-layout';
import { serializeToReactFlow } from '@/lib/graph/react-flow-adapter';
import type {
  DirectoryGraphNode,
  FileGraphNode,
  RepositoryGraphNode,
} from '@/lib/graph/graph-model';

const mockMetadata: RepositoryMetadata = {
  owner: 'acme',
  name: 'widget',
  fullName: 'acme/widget',
  description: 'Deterministic test repository',
  htmlUrl: 'https://github.com/acme/widget',
  defaultBranch: 'main',
  visibility: 'public',
  isFork: false,
  isArchived: false,
  stars: 120,
  forks: 15,
  openIssues: 3,
  watchers: 120,
  license: {
    key: 'mit',
    name: 'MIT License',
    spdxId: 'MIT',
    url: 'https://api.github.com/licenses/mit',
  },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-02-01T00:00:00Z',
  pushedAt: '2024-02-01T00:00:00Z',
  language: 'TypeScript',
  topics: ['testing', 'deterministic'],
  homepage: null,
  sizeKb: 5,
};

const mockTree: RepositoryTree = {
  sha: 'tree123',
  truncated: false,
  totalFiles: 4,
  totalDirectories: 3,
  totalBytes: 5300,
  entries: [
    {
      path: 'src',
      mode: '040000',
      type: 'tree',
      sha: 'dir_src',
      name: 'src',
    },
    {
      path: 'src/lib',
      mode: '040000',
      type: 'tree',
      sha: 'dir_lib',
      name: 'lib',
    },
    {
      path: 'src/lib/math.ts',
      mode: '100644',
      type: 'blob',
      sha: 'blob_math',
      size: 1500,
      name: 'math.ts',
    },
    {
      path: 'src/index.ts',
      mode: '100644',
      type: 'blob',
      sha: 'blob_index',
      size: 800,
      name: 'index.ts',
    },
    {
      path: 'docs',
      mode: '040000',
      type: 'tree',
      sha: 'dir_docs',
      name: 'docs',
    },
    {
      path: 'docs/readme.md',
      mode: '100644',
      type: 'blob',
      sha: 'blob_readme',
      size: 2400,
      name: 'readme.md',
    },
    {
      path: 'package.json',
      mode: '100644',
      type: 'blob',
      sha: 'blob_pkg',
      size: 600,
      name: 'package.json',
    },
  ],
};

describe('Graph Engine — Construction (tree-to-graph)', () => {
  it('builds a normalized graph from repository tree and metadata', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);

    expect(graph.rootId).toBe('repo:acme/widget');
    // Root + 3 dirs + 4 files = 8 nodes
    expect(graph.nodes.size).toBe(8);

    // Root node verification
    const rootNode = graph.nodes.get('repo:acme/widget') as RepositoryGraphNode;
    expect(rootNode).toBeDefined();
    expect(rootNode.type).toBe('repository');
    expect(rootNode.depth).toBe(0);
    expect(rootNode.name).toBe('widget');
    expect(rootNode.totalFiles).toBe(4);
    expect(rootNode.totalDirectories).toBe(3);
    expect(rootNode.totalBytes).toBe(1500 + 800 + 2400 + 600); // 5300 bytes

    // Directory nodes verification
    const srcNode = graph.nodes.get('dir:src') as DirectoryGraphNode;
    expect(srcNode).toBeDefined();
    expect(srcNode.type).toBe('directory');
    expect(srcNode.depth).toBe(1);
    expect(srcNode.parentId).toBe('repo:acme/widget');
    // src contains: index.ts (800) and lib/math.ts (1500)
    expect(srcNode.totalDescendantBytes).toBe(2300);
    expect(srcNode.totalDescendantFiles).toBe(2);
    expect(srcNode.childDirectoryCount).toBe(1);
    expect(srcNode.childFileCount).toBe(1);

    // Subdirectory verification
    const libNode = graph.nodes.get('dir:src/lib') as DirectoryGraphNode;
    expect(libNode).toBeDefined();
    expect(libNode.depth).toBe(2);
    expect(libNode.parentId).toBe('dir:src');
    expect(libNode.totalDescendantBytes).toBe(1500);
    expect(libNode.totalDescendantFiles).toBe(1);

    // File nodes verification
    const mathNode = graph.nodes.get('file:src/lib/math.ts') as FileGraphNode;
    expect(mathNode).toBeDefined();
    expect(mathNode.type).toBe('file');
    expect(mathNode.depth).toBe(3);
    expect(mathNode.extension).toBe('ts');
    expect(mathNode.size).toBe(1500);
    expect(mathNode.parentId).toBe('dir:src/lib');

    // Edges verification: 7 child nodes = 7 CONTAINS edges
    expect(graph.edges.length).toBe(7);
    const rootToSrcEdge = graph.edges.find(
      (e) => e.source === 'repo:acme/widget' && e.target === 'dir:src'
    );
    expect(rootToSrcEdge).toBeDefined();
    expect(rootToSrcEdge?.type).toBe('CONTAINS');
  });
});

describe('Graph Engine — Collapsing & Visibility (graph-collapse)', () => {
  it('derives initial collapsed directory IDs according to depth threshold', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);

    // maxAutoExpandDepth = 2 means directories with depth >= 2 (e.g. src/lib) are collapsed
    const collapsed = getInitialCollapsedDirectoryIds(graph, 2);
    expect(collapsed.has('dir:src/lib')).toBe(true);
    expect(collapsed.has('dir:src')).toBe(false);
    expect(collapsed.has('dir:docs')).toBe(false);
  });

  it('toggles directory collapse state idempotently', () => {
    const set1 = new Set(['dir:src']);
    const set2 = toggleDirectoryCollapse(set1, 'dir:src');
    expect(set2.has('dir:src')).toBe(false);

    const set3 = toggleDirectoryCollapse(set2, 'dir:docs');
    expect(set3.has('dir:docs')).toBe(true);
  });

  it('correctly expands all and collapses all directories', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);

    const allExpanded = expandAllDirectories();
    expect(allExpanded.size).toBe(0);

    const allCollapsed = collapseAllDirectories(graph);
    expect(allCollapsed.size).toBe(3);
    expect(allCollapsed.has('dir:src')).toBe(true);
    expect(allCollapsed.has('dir:src/lib')).toBe(true);
    expect(allCollapsed.has('dir:docs')).toBe(true);
  });

  it('filters out child nodes and edges when parent directory is collapsed', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);

    // Collapse 'dir:src'
    const collapsed = new Set(['dir:src']);
    const { visibleNodes, visibleEdges, visibleNodeIds } = getVisibleGraph(graph, collapsed);

    // src is visible, but its children (src/index.ts, src/lib, src/lib/math.ts) must be hidden
    expect(visibleNodeIds.has('dir:src')).toBe(true);
    expect(visibleNodeIds.has('file:src/index.ts')).toBe(false);
    expect(visibleNodeIds.has('dir:src/lib')).toBe(false);
    expect(visibleNodeIds.has('file:src/lib/math.ts')).toBe(false);

    // docs and its children and package.json remain visible
    expect(visibleNodeIds.has('dir:docs')).toBe(true);
    expect(visibleNodeIds.has('file:docs/readme.md')).toBe(true);
    expect(visibleNodeIds.has('file:package.json')).toBe(true);

    // Total visible: root + src + docs + readme.md + package.json = 5
    expect(visibleNodes.length).toBe(5);

    // Edges connected to hidden nodes must NOT be present
    for (const edge of visibleEdges) {
      expect(visibleNodeIds.has(edge.source)).toBe(true);
      expect(visibleNodeIds.has(edge.target)).toBe(true);
    }
  });
});

describe('Graph Engine — Filtering & Search (graph-filter)', () => {
  it('filters by query and extracts necessary ancestor directory IDs to reveal matches', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);

    const result = filterGraph(graph, { query: 'math' });
    expect(result.totalMatches).toBe(1);
    expect(result.matchingNodeIds.has('file:src/lib/math.ts')).toBe(true);

    // Ancestor path: src/lib and src
    expect(result.ancestorIdsToExpand.has('dir:src/lib')).toBe(true);
    expect(result.ancestorIdsToExpand.has('dir:src')).toBe(true);
  });

  it('filters by file extension', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);

    const result = filterGraph(graph, { extension: 'ts' });
    // math.ts and index.ts
    expect(result.totalMatches).toBe(2);
    expect(result.matchingNodeIds.has('file:src/lib/math.ts')).toBe(true);
    expect(result.matchingNodeIds.has('file:src/index.ts')).toBe(true);
    expect(result.matchingNodeIds.has('file:docs/readme.md')).toBe(false);
  });

  it('filters by type: directory vs file', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);

    const dirResult = filterGraph(graph, { typeFilter: 'directory' });
    expect(dirResult.totalMatches).toBe(3);
    expect(dirResult.matchingNodeIds.has('dir:src')).toBe(true);
    expect(dirResult.matchingNodeIds.has('dir:src/lib')).toBe(true);
    expect(dirResult.matchingNodeIds.has('dir:docs')).toBe(true);

    const fileResult = filterGraph(graph, { typeFilter: 'file' });
    expect(fileResult.totalMatches).toBe(4);
  });

  it('extracts unique sorted list of available file extensions', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);
    const exts = getAvailableExtensions(graph);
    // json, md, ts
    expect(exts).toEqual(['json', 'md', 'ts']);
  });
});

describe('Graph Engine — Layout (graph-layout)', () => {
  it('computes deterministic, collision-free hierarchical coordinates', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);
    const { visibleNodes, visibleNodeIds } = getVisibleGraph(graph, new Set());

    const positions = computeHierarchicalLayout(graph, visibleNodeIds);

    expect(positions.size).toBe(visibleNodes.length);

    // Root should be at depth 0, x = 0
    const rootPos = positions.get(graph.rootId);
    expect(rootPos).toBeDefined();
    expect(rootPos?.x).toBe(0);

    // Every node must have non-null x and y coordinates
    for (const node of visibleNodes) {
      const pos = positions.get(node.id);
      expect(pos).toBeDefined();
      expect(Number.isFinite(pos?.x)).toBe(true);
      expect(Number.isFinite(pos?.y)).toBe(true);
    }

    // Verify depth progression: deeper nodes have strictly greater x coordinates
    const srcPos = positions.get('dir:src')!;
    const libPos = positions.get('dir:src/lib')!;
    const mathPos = positions.get('file:src/lib/math.ts')!;

    expect(srcPos.x).toBeGreaterThan(rootPos!.x);
    expect(libPos.x).toBeGreaterThan(srcPos.x);
    expect(mathPos.x).toBeGreaterThan(libPos.x);

    // Verify vertical spacing: nodes at the same x position must have distinct y coordinates
    const nodesAtDepth1 = visibleNodes.filter((n) => n.depth === 1);
    const yValues = nodesAtDepth1.map((n) => positions.get(n.id)!.y);
    const uniqueYValues = new Set(yValues);
    expect(uniqueYValues.size).toBe(nodesAtDepth1.length);
  });
});

describe('Graph Engine — React Flow Adapter (react-flow-adapter)', () => {
  it('serializes graph data model into React Flow nodes and edges', () => {
    const graph = buildRepositoryGraph(mockMetadata, mockTree);
    const { visibleNodes, visibleEdges, visibleNodeIds } = getVisibleGraph(
      graph,
      new Set(['dir:src/lib'])
    );
    const positions = computeHierarchicalLayout(graph, visibleNodeIds);

    const serialized = serializeToReactFlow(visibleNodes, visibleEdges, positions, {
      collapsedDirIds: new Set(['dir:src/lib']),
      matchingNodeIds: new Set(['file:package.json']),
      selectedNodeId: 'dir:src',
    });

    expect(serialized.nodes.length).toBe(visibleNodes.length);
    expect(serialized.edges.length).toBe(visibleEdges.length);

    // Find serialized repo node
    const repoFlow = serialized.nodes.find((n) => n.id === graph.rootId);
    expect(repoFlow?.type).toBe('repoNode');
    expect(repoFlow?.data.node.type).toBe('repository');

    // Find serialized selected directory node
    const dirFlow = serialized.nodes.find((n) => n.id === 'dir:src');
    expect(dirFlow?.type).toBe('dirNode');
    expect(dirFlow?.data.isSelected).toBe(true);
    expect(dirFlow?.data.isCollapsed).toBe(false);

    // Find serialized collapsed directory node
    const collapsedDirFlow = serialized.nodes.find((n) => n.id === 'dir:src/lib');
    expect(collapsedDirFlow?.data.isCollapsed).toBe(true);

    // Find matching file node
    const matchFlow = serialized.nodes.find((n) => n.id === 'file:package.json');
    expect(matchFlow?.type).toBe('fileNode');
    expect(matchFlow?.data.isMatching).toBe(true);
  });
});
