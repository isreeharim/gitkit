import type { RepoGraph, RepoGraphNode, RepoGraphEdge } from './graph-model';

/**
 * Derives initial set of collapsed directory node IDs based on depth.
 * Keeps root (depth 0) and top-level directories (depth 1) expanded,
 * collapsing depth >= 2 to keep initial view clean and performant.
 */
export function getInitialCollapsedDirectoryIds(
  graph: RepoGraph,
  maxAutoExpandDepth = 1
): Set<string> {
  const collapsed = new Set<string>();

  for (const node of graph.nodes.values()) {
    if (node.type === 'directory' && node.depth >= maxAutoExpandDepth) {
      collapsed.add(node.id);
    }
  }

  return collapsed;
}

/**
 * Toggles collapse state for a directory node.
 */
export function toggleDirectoryCollapse(currentCollapsed: Set<string>, dirId: string): Set<string> {
  const updated = new Set(currentCollapsed);
  if (updated.has(dirId)) {
    updated.delete(dirId);
  } else {
    updated.add(dirId);
  }
  return updated;
}

/**
 * Expands all directories in the graph.
 */
export function expandAllDirectories(): Set<string> {
  return new Set<string>();
}

/**
 * Collapses all directories in the graph.
 */
export function collapseAllDirectories(graph: RepoGraph): Set<string> {
  const allDirs = new Set<string>();
  for (const node of graph.nodes.values()) {
    if (node.type === 'directory') {
      allDirs.add(node.id);
    }
  }
  return allDirs;
}

/**
 * Traverses from root and filters out nodes/edges contained inside collapsed directories.
 * Guarantees that hidden/collapsed branches do not consume rendering or layout cycles.
 */
export function getVisibleGraph(
  graph: RepoGraph,
  collapsedDirIds: Set<string>
): {
  visibleNodes: RepoGraphNode[];
  visibleEdges: RepoGraphEdge[];
  visibleNodeIds: Set<string>;
} {
  const visibleNodeIds = new Set<string>();
  const visibleEdges: RepoGraphEdge[] = [];
  const edgeMap = new Map<string, RepoGraphEdge>();

  for (const edge of graph.edges) {
    edgeMap.set(edge.id, edge);
  }

  // Breadth-first traversal starting from root
  const queue: string[] = [graph.rootId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    visibleNodeIds.add(currentId);

    const currentNode = graph.nodes.get(currentId);
    if (!currentNode) continue;

    // If current node is a directory AND it is collapsed, stop descending
    if (currentNode.type === 'directory' && collapsedDirIds.has(currentId)) {
      continue;
    }

    // Traverse children
    for (const childId of currentNode.childIds) {
      const childNode = graph.nodes.get(childId);
      if (childNode) {
        queue.push(childId);

        const edgeId = `edge:${currentId}->${childId}`;
        const edge = edgeMap.get(edgeId);
        if (edge) {
          visibleEdges.push(edge);
        }
      }
    }
  }

  const visibleNodes: RepoGraphNode[] = [];
  for (const id of visibleNodeIds) {
    const node = graph.nodes.get(id);
    if (node) {
      visibleNodes.push(node);
    }
  }

  return {
    visibleNodes,
    visibleEdges,
    visibleNodeIds,
  };
}
