import type { DiagramGraph, DiagramNode, DiagramEdge } from '@/types/diagram';

export function normalizeDiagramText(value: string): string {
  return value
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/**
 * Escapes characters that break Mermaid lexer or allow XSS/entity injection.
 */
export function escapeMermaidText(value: string): string {
  const escaped = normalizeDiagramText(value)
    .replace(/&/g, '&amp;')
    .replace(/#/g, '&#35;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/`/g, '&#96;')
    .replace(/\\/g, '&#92;')
    .replace(/\|/g, '&#124;')
    .replace(/\[/g, '&#91;')
    .replace(/\]/g, '&#93;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;')
    .replace(/\(/g, '&#40;')
    .replace(/\)/g, '&#41;')
    .trim();

  return escaped || 'Unnamed';
}

export function sanitizeMermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+/, '');
}

function renderNodeShape(nodeId: string, label: string, shape: DiagramNode['shape']): string {
  switch (shape) {
    case 'database':
      return `${nodeId}[("${label}")]`;
    case 'circle':
      return `${nodeId}(("${label}"))`;
    case 'hexagon':
      return `${nodeId}{{"${label}"}}`;
    case 'queue':
      return `${nodeId}[/"${label}"/]`;
    case 'box':
    default:
      return `${nodeId}["${label}"]`;
  }
}

function renderEdge(edge: DiagramEdge): string {
  const connector = edge.style === 'dashed' ? '-.->' : '-->';
  const from = sanitizeMermaidId(edge.from);
  const to = sanitizeMermaidId(edge.to);

  if (!edge.label) {
    return `${from} ${connector} ${to}`;
  }

  return `${from} ${connector}|"${escapeMermaidText(edge.label)}"| ${to}`;
}

export interface CompileDiagramOptions {
  owner: string;
  repo: string;
  defaultBranch?: string;
}

/**
 * Deterministically compiles a DiagramGraph into production-ready Mermaid syntax.
 */
export function compileDiagramToMermaid(
  graph: DiagramGraph,
  options: CompileDiagramOptions
): string {
  const { owner, repo, defaultBranch = 'main' } = options;
  const lines: string[] = ['flowchart TD'];

  const groupedNodeIds = new Set<string>();
  const classAssignments = new Map<string, string[]>();

  const pushNode = (node: DiagramNode, indent = '  ') => {
    const safeNodeId = sanitizeMermaidId(node.id);
    const safeLabel = escapeMermaidText(node.label);
    const safeType =
      node.type && node.type !== 'component'
        ? `<small>[${escapeMermaidText(node.type)}]</small>`
        : null;
    const labelWithRole = [safeLabel, safeType].filter(Boolean).join('<br/>');
    lines.push(`${indent}${renderNodeShape(safeNodeId, labelWithRole, node.shape)}`);

    const currentList = classAssignments.get(node.tone) || [];
    currentList.push(safeNodeId);
    classAssignments.set(node.tone, currentList);
  };

  // 1. Subsystems (Groups)
  for (const group of graph.groups) {
    const safeGroupId = sanitizeMermaidId(`group_${group.id}`);
    lines.push('');
    lines.push(`  subgraph ${safeGroupId}["${escapeMermaidText(group.label)}"]`);
    for (const node of graph.nodes.filter((n) => n.groupId === group.id)) {
      pushNode(node, '    ');
      groupedNodeIds.add(node.id);
    }
    lines.push('  end');
  }

  // 2. Ungrouped Nodes
  const ungrouped = graph.nodes.filter((n) => !groupedNodeIds.has(n.id));
  if (ungrouped.length > 0) {
    lines.push('');
    for (const node of ungrouped) {
      pushNode(node, '  ');
    }
  }

  // 3. Edges
  if (graph.edges.length > 0) {
    lines.push('');
    for (const edge of graph.edges) {
      lines.push(`  ${renderEdge(edge)}`);
    }
  }

  // 4. Interactive Click Directives (Links to GitHub source)
  const nodesWithPaths = graph.nodes.filter((n) => n.path);
  if (nodesWithPaths.length > 0) {
    lines.push('');
    for (const node of nodesWithPaths) {
      const safeNodeId = sanitizeMermaidId(node.id);
      const encodedPath = node.path!.split('/').map(encodeURIComponent).join('/');
      const isDirectory = !node.path!.includes('.') || node.path!.endsWith('/');
      const pathType = isDirectory ? 'tree' : 'blob';
      const url = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${pathType}/${encodeURIComponent(defaultBranch)}/${encodedPath}`;
      lines.push(`  click ${safeNodeId} "${url}" "${escapeMermaidText(node.path!)}" _blank`);
    }
  }

  // 5. Dark IDE / GitHub-Linear Class Definitions
  lines.push('');
  lines.push('  classDef toneBlue fill:#0f172a,stroke:#3b82f6,stroke-width:1.5px,color:#f8fafc');
  lines.push('  classDef toneMint fill:#064e3b,stroke:#10b981,stroke-width:1.5px,color:#f8fafc');
  lines.push('  classDef toneIndigo fill:#1e1b4b,stroke:#6366f1,stroke-width:1.5px,color:#f8fafc');
  lines.push('  classDef toneAmber fill:#451a03,stroke:#f59e0b,stroke-width:1.5px,color:#f8fafc');
  lines.push('  classDef toneRose fill:#4c0519,stroke:#f43f5e,stroke-width:1.5px,color:#f8fafc');
  lines.push('  classDef toneTeal fill:#134e4a,stroke:#14b8a6,stroke-width:1.5px,color:#f8fafc');

  // 6. Assign Classes to Nodes
  for (const [toneClass, nodeIds] of classAssignments.entries()) {
    if (nodeIds.length > 0) {
      lines.push(`  class ${nodeIds.join(',')} ${toneClass}`);
    }
  }

  return lines.join('\n');
}
