import type { RepoGraph, NodeLayoutPosition } from './graph-model';

export interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  horizontalGap?: number;
  verticalGap?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  nodeWidth: 260,
  nodeHeight: 74,
  horizontalGap: 100,
  verticalGap: 24,
};

/**
 * Computes deterministic 2D positions for visible nodes using a hierarchical
 * left-to-right tree layout algorithm.
 *
 * Guarantees:
 * - Subtrees do not overlap
 * - Parent nodes are centered vertically alongside their direct visible children
 * - 100% mathematically reproducible coordinates
 */
export function computeHierarchicalLayout(
  graph: RepoGraph,
  visibleNodeIds: Set<string>,
  options: LayoutOptions = {}
): Map<string, NodeLayoutPosition> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const positions = new Map<string, NodeLayoutPosition>();

  if (!visibleNodeIds.has(graph.rootId)) {
    return positions;
  }

  // Filter children to only those currently visible
  const getVisibleChildren = (nodeId: string): string[] => {
    const node = graph.nodes.get(nodeId);
    if (!node) return [];
    return node.childIds.filter((childId) => visibleNodeIds.has(childId));
  };

  let currentY = 0;

  // First pass: position leaves and compute bounding heights
  const layoutSubtree = (nodeId: string): { topY: number; bottomY: number; centerY: number } => {
    const node = graph.nodes.get(nodeId)!;
    const children = getVisibleChildren(nodeId);
    const x = node.depth * (config.nodeWidth + config.horizontalGap);

    if (children.length === 0) {
      // Leaf node in the visible graph
      const y = currentY;
      currentY += config.nodeHeight + config.verticalGap;
      positions.set(nodeId, { x, y });
      return { topY: y, bottomY: y + config.nodeHeight, centerY: y };
    }

    // Node has visible children: recursively layout all children first
    const childCenters: number[] = [];
    let minChildY = Infinity;
    let maxChildY = -Infinity;

    for (const childId of children) {
      const childLayout = layoutSubtree(childId);
      childCenters.push(childLayout.centerY);
      minChildY = Math.min(minChildY, childLayout.topY);
      maxChildY = Math.max(maxChildY, childLayout.bottomY);
    }

    // Center parent vertically relative to its children
    const centerY =
      childCenters.length > 0
        ? (childCenters[0] + childCenters[childCenters.length - 1]) / 2
        : minChildY;

    positions.set(nodeId, { x, y: centerY });

    return {
      topY: Math.min(centerY, minChildY),
      bottomY: Math.max(centerY + config.nodeHeight, maxChildY),
      centerY,
    };
  };

  layoutSubtree(graph.rootId);

  return positions;
}
