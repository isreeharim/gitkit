import type { Node as ReactFlowNode, Edge as ReactFlowEdge } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import type { DependencyNode, DependencyEdge, CircularDependencyCycle } from '@/types/dependency';
import type { DependencyLayoutPosition } from './graph-layout';

export interface DependencyNodePayload {
  [key: string]: unknown;
  node: DependencyNode;
  isSelected: boolean;
  isMatching: boolean;
  onSelectNode?: (nodeId: string) => void;
}

export interface DependencySerializationOptions {
  selectedNodeId: string | null;
  matchingNodeIds: Set<string>;
  cycles: CircularDependencyCycle[];
  onSelectNode?: (nodeId: string) => void;
}

/**
 * Serializes GitKit dependency models into React Flow nodes and edges with cycle highlighting.
 */
export function serializeDependenciesToReactFlow(
  nodes: DependencyNode[],
  edges: DependencyEdge[],
  positions: Map<string, DependencyLayoutPosition>,
  options: DependencySerializationOptions
): {
  nodes: ReactFlowNode<DependencyNodePayload>[];
  edges: ReactFlowEdge[];
} {
  const cycleEdgeIds = new Set<string>();
  for (const cycle of options.cycles) {
    for (const edgeId of cycle.edgeIds) {
      cycleEdgeIds.add(edgeId);
    }
  }

  const flowNodes: ReactFlowNode<DependencyNodePayload>[] = nodes.map((node) => {
    const pos = positions.get(node.id) || { x: 0, y: 0 };
    const isSelected = options.selectedNodeId === node.id;
    const isMatching = options.matchingNodeIds.has(node.id);

    return {
      id: node.id,
      type: node.type === 'file' ? 'depFileNode' : 'depPackageNode',
      position: pos,
      data: {
        node,
        isSelected,
        isMatching,
        onSelectNode: options.onSelectNode,
      },
    };
  });

  const flowEdges: ReactFlowEdge[] = edges.map((edge) => {
    const sourceNodeId = `file:${edge.sourceFile}`;
    const targetNodeId = edge.kind === 'internal' ? `file:${edge.target}` : `pkg:${edge.target}`;

    const isCycleEdge = cycleEdgeIds.has(edge.id);

    // Styling based on edge kind
    let strokeColor = '#38bdf8'; // internal default
    let isDashed = false;

    if (isCycleEdge) {
      strokeColor = '#f43f5e'; // rose-500
    } else if (edge.kind === 'external') {
      strokeColor = '#a855f7'; // purple-500
    } else if (edge.kind === 'unresolved') {
      strokeColor = '#f59e0b'; // amber-500
      isDashed = true;
    }

    return {
      id: edge.id,
      source: sourceNodeId,
      target: targetNodeId,
      type: 'smoothstep',
      animated: isCycleEdge,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: strokeColor,
        width: 15,
        height: 15,
      },
      style: {
        stroke: strokeColor,
        strokeWidth: isCycleEdge ? 2.5 : 1.5,
        strokeDasharray: isDashed ? '4,4' : undefined,
      },
      label: edge.isTypeOnly ? 'type' : undefined,
      labelStyle: {
        fill: '#94a3b8',
        fontSize: 10,
        fontFamily: 'monospace',
      },
      data: {
        isCycle: isCycleEdge,
        kind: edge.kind,
      },
    };
  });

  return { nodes: flowNodes, edges: flowEdges };
}
