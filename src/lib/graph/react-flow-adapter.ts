import type { Node as ReactFlowNode, Edge as ReactFlowEdge } from '@xyflow/react';
import type { RepoGraphNode, RepoGraphEdge, NodeLayoutPosition } from './graph-model';

export interface NodeDataPayload {
  [key: string]: unknown;
  node: RepoGraphNode;
  isCollapsed: boolean;
  isMatching: boolean;
  isSelected: boolean;
  onToggleCollapse?: (dirId: string) => void;
  onSelectNode?: (nodeId: string) => void;
}

export interface SerializationOptions {
  collapsedDirIds: Set<string>;
  matchingNodeIds: Set<string>;
  selectedNodeId: string | null;
  onToggleCollapse?: (dirId: string) => void;
  onSelectNode?: (nodeId: string) => void;
}

/**
 * Serializes internal GitKit graph nodes and edges into React Flow format.
 */
export function serializeToReactFlow(
  visibleNodes: RepoGraphNode[],
  visibleEdges: RepoGraphEdge[],
  positions: Map<string, NodeLayoutPosition>,
  options: SerializationOptions
): {
  nodes: ReactFlowNode<NodeDataPayload>[];
  edges: ReactFlowEdge[];
} {
  const nodes: ReactFlowNode<NodeDataPayload>[] = visibleNodes.map((node) => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    const isCollapsed = node.type === 'directory' && options.collapsedDirIds.has(node.id);
    const isMatching = options.matchingNodeIds.has(node.id);
    const isSelected = options.selectedNodeId === node.id;

    let flowType = 'fileNode';
    if (node.type === 'repository') flowType = 'repoNode';
    if (node.type === 'directory') flowType = 'dirNode';

    return {
      id: node.id,
      type: flowType,
      position: pos,
      data: {
        node,
        isCollapsed,
        isMatching,
        isSelected,
        onToggleCollapse: options.onToggleCollapse,
        onSelectNode: options.onSelectNode,
      },
    };
  });

  const edges: ReactFlowEdge[] = visibleEdges.map((edge) => {
    const isSourceMatching = options.matchingNodeIds.has(edge.source);
    const isTargetMatching = options.matchingNodeIds.has(edge.target);
    const isHighlighted = isSourceMatching && isTargetMatching;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: isHighlighted,
      style: {
        stroke: isHighlighted ? '#10b981' : '#334155',
        strokeWidth: isHighlighted ? 2 : 1.5,
      },
    };
  });

  return { nodes, edges };
}
