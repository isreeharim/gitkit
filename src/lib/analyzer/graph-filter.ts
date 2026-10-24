import type { DependencyGraph, DependencyNode, DependencyEdge } from '@/types/dependency';

export type DependencyFilterMode = 'all' | 'internal' | 'external' | 'unresolved' | 'cycles_only';

export interface DependencyFilterOptions {
  searchQuery?: string;
  filterMode?: DependencyFilterMode;
}

export interface FilteredDependencyGraph {
  visibleNodes: DependencyNode[];
  visibleEdges: DependencyEdge[];
  matchingNodeIds: Set<string>;
  totalMatches: number;
}

/**
 * Deterministically filters dependency graph nodes and edges according to search query and filter modes.
 */
export function filterDependencyGraph(
  graph: DependencyGraph,
  options: DependencyFilterOptions
): FilteredDependencyGraph {
  const query = options.searchQuery?.trim().toLowerCase() || '';
  const mode = options.filterMode || 'all';

  const matchingNodeIds = new Set<string>();

  // 1. Identify matching nodes based on query and mode
  for (const node of graph.nodes.values()) {
    let matchesMode = true;

    if (mode === 'internal') {
      matchesMode = node.type === 'file';
    } else if (mode === 'external') {
      matchesMode = node.type === 'package';
    } else if (mode === 'unresolved') {
      matchesMode =
        (node.type === 'package' && Boolean(node.isUnresolved)) ||
        graph.edges.some(
          (e) =>
            e.kind === 'unresolved' &&
            (e.sourceFile === (node as { path?: string }).path || e.target === node.name)
        );
    } else if (mode === 'cycles_only') {
      matchesMode = node.type === 'file' && node.inCycle;
    }

    if (!matchesMode) continue;

    // Search query matching
    let matchesQuery = true;
    if (query) {
      if (node.type === 'file') {
        matchesQuery =
          node.path.toLowerCase().includes(query) || node.name.toLowerCase().includes(query);
      } else {
        matchesQuery = node.name.toLowerCase().includes(query);
      }
    }

    if (matchesQuery) {
      matchingNodeIds.add(node.id);
    }
  }

  // 2. If filtering by cycles_only, also include cycle edges and all cycle nodes
  const cycleEdgeIds = new Set<string>();
  if (mode === 'cycles_only') {
    for (const cycle of graph.cycles) {
      for (const edgeId of cycle.edgeIds) {
        cycleEdgeIds.add(edgeId);
      }
    }
  }

  // 3. Filter edges
  const visibleEdges: DependencyEdge[] = [];
  const connectedNodeIds = new Set<string>();

  for (const edge of graph.edges) {
    const sourceNodeId = `file:${edge.sourceFile}`;
    const targetNodeId = edge.kind === 'internal' ? `file:${edge.target}` : `pkg:${edge.target}`;

    if (mode === 'cycles_only') {
      if (cycleEdgeIds.has(edge.id)) {
        visibleEdges.push(edge);
        connectedNodeIds.add(sourceNodeId);
        connectedNodeIds.add(targetNodeId);
      }
      continue;
    }

    // Filter by mode
    if (mode === 'internal' && edge.kind !== 'internal') continue;
    if (mode === 'external' && edge.kind !== 'external') continue;
    if (mode === 'unresolved' && edge.kind !== 'unresolved') continue;

    // If query is active, edge is visible if either source or target matches
    if (query) {
      if (matchingNodeIds.has(sourceNodeId) || matchingNodeIds.has(targetNodeId)) {
        visibleEdges.push(edge);
        connectedNodeIds.add(sourceNodeId);
        connectedNodeIds.add(targetNodeId);
      }
    } else {
      visibleEdges.push(edge);
      connectedNodeIds.add(sourceNodeId);
      connectedNodeIds.add(targetNodeId);
    }
  }

  // 4. Determine final visible nodes
  const visibleNodes: DependencyNode[] = [];
  for (const node of graph.nodes.values()) {
    if (matchingNodeIds.has(node.id) || connectedNodeIds.has(node.id)) {
      visibleNodes.push(node);
    }
  }

  return {
    visibleNodes,
    visibleEdges,
    matchingNodeIds,
    totalMatches: matchingNodeIds.size,
  };
}
