export type DiagramNodeShape = 'box' | 'database' | 'queue' | 'circle' | 'hexagon';

export type DiagramEdgeStyle = 'solid' | 'dashed';

export type DiagramTone =
  'toneBlue' | 'toneMint' | 'toneIndigo' | 'toneAmber' | 'toneRose' | 'toneTeal';

export interface DiagramGroup {
  id: string;
  label: string;
  description?: string | null;
}

export interface DiagramNode {
  id: string;
  label: string;
  type: string;
  description?: string | null;
  groupId?: string | null;
  path?: string | null;
  shape: DiagramNodeShape;
  tone: DiagramTone;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string | null;
  style?: DiagramEdgeStyle;
  evidencePath?: string | null;
}

export interface DiagramGraph {
  groups: DiagramGroup[];
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  summary: {
    totalComponents: number;
    subsystemsCount: number;
    relationshipsCount: number;
    primaryLanguage?: string;
  };
}
