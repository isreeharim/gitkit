import type { RepoGraph } from '@/lib/graph/graph-model';
import type { DependencyGraph } from '@/types/dependency';

export interface MermaidRepoOptions {
  readonly maxDepth?: number;
  readonly visibleNodeIds?: Set<string>;
}

export interface MermaidDependencyOptions {
  readonly includeExternal?: boolean;
  readonly highlightCycles?: boolean;
}

/**
 * Sanitizes a node ID for Mermaid compatibility.
 * Mermaid node identifiers should be alphanumeric plus underscores.
 */
function toMermaidId(rawId: string): string {
  const sanitized = rawId.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
  return `n_${sanitized}`;
}

/**
 * Sanitizes label text for safe inclusion within Mermaid node brackets ["..."].
 */
function toMermaidLabel(text: string): string {
  return text
    .replace(/"/g, "'")
    .replace(/[\r\n]+/g, ' ')
    .trim();
}

/**
 * Generates deterministic Mermaid flowchart syntax for repository file structure.
 *
 * Example:
 * ```mermaid
 * flowchart TD
 *   n_repo["📦 octocat/Hello-World (main)"]
 *   n_src["📁 src"]
 *   n_repo --> n_src
 * ```
 */
export function generateRepoStructureMermaid(
  graph: RepoGraph,
  options: MermaidRepoOptions = {}
): string {
  const maxDepth = options.maxDepth ?? Infinity;
  const visibleIds = options.visibleNodeIds || new Set(graph.nodes.keys());

  const lines: string[] = ['flowchart TD'];

  // Collect and sort nodes deterministically
  const nodes = Array.from(graph.nodes.values())
    .filter((n) => visibleIds.has(n.id) && n.depth <= maxDepth)
    .sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      if (a.type !== b.type) {
        if (a.type === 'repository') return -1;
        if (b.type === 'repository') return 1;
        if (a.type === 'directory') return -1;
        if (b.type === 'directory') return 1;
      }
      return a.path.localeCompare(b.path);
    });

  const repoClassNodes: string[] = [];
  const dirClassNodes: string[] = [];
  const fileClassNodes: string[] = [];

  for (const node of nodes) {
    const mId = toMermaidId(node.id);
    let label = '';

    if (node.type === 'repository') {
      label = `📦 ${node.owner}/${node.repo} (${node.defaultBranch})`;
      repoClassNodes.push(mId);
    } else if (node.type === 'directory') {
      label = `📁 ${node.name}/`;
      dirClassNodes.push(mId);
    } else {
      label = `📄 ${node.name}`;
      fileClassNodes.push(mId);
    }

    lines.push(`  ${mId}["${toMermaidLabel(label)}"]`);
  }

  lines.push('');

  // Collect and sort edges deterministically
  const validNodeIds = new Set(nodes.map((n) => n.id));
  const edges = graph.edges
    .filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target))
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const edge of edges) {
    const sourceMId = toMermaidId(edge.source);
    const targetMId = toMermaidId(edge.target);
    lines.push(`  ${sourceMId} --> ${targetMId}`);
  }

  // Styles
  lines.push('');
  lines.push('  classDef repo fill:#1e3a8a,stroke:#3b82f6,stroke-width:2px,color:#f8fafc;');
  lines.push('  classDef dir fill:#064e3b,stroke:#10b981,stroke-width:1.5px,color:#f8fafc;');
  lines.push('  classDef file fill:#18181b,stroke:#3f3f46,stroke-width:1px,color:#e4e4e7;');

  if (repoClassNodes.length > 0) lines.push(`  class ${repoClassNodes.join(',')} repo;`);
  if (dirClassNodes.length > 0) lines.push(`  class ${dirClassNodes.join(',')} dir;`);
  if (fileClassNodes.length > 0) lines.push(`  class ${fileClassNodes.join(',')} file;`);

  return lines.join('\n');
}

/**
 * Generates deterministic Mermaid flowchart syntax for the module dependency graph.
 *
 * Example:
 * ```mermaid
 * flowchart LR
 *   n_src_App["📄 src/App.tsx"]
 *   n_src_Header["📄 src/components/Header.tsx"]
 *   n_react[["📦 react (npm)"]]
 *   n_src_App -->|imports| n_src_Header
 *   n_src_App -.->|depends on| n_react
 * ```
 */
export function generateDependencyMermaid(
  graph: DependencyGraph,
  options: MermaidDependencyOptions = {}
): string {
  const includeExternal = options.includeExternal ?? true;
  const highlightCycles = options.highlightCycles ?? true;

  const lines: string[] = ['flowchart LR'];

  // Collect nodes
  const allNodes = Array.from(graph.nodes.values());
  const nodes = (includeExternal ? allNodes : allNodes.filter((n) => n.type === 'file')).sort(
    (a, b) => a.id.localeCompare(b.id)
  );

  const validNodeIds = new Set(nodes.map((n) => n.id));

  const fileClassNodes: string[] = [];
  const pkgClassNodes: string[] = [];
  const cycleClassNodes: string[] = [];

  for (const node of nodes) {
    const mId = toMermaidId(node.id);

    if (node.type === 'package') {
      const label = `📦 ${node.name} (${node.ecosystem})`;
      lines.push(`  ${mId}[["${toMermaidLabel(label)}"]]`);
      pkgClassNodes.push(mId);
    } else {
      const label = `📄 ${node.path}`;
      lines.push(`  ${mId}["${toMermaidLabel(label)}"]`);
      if (highlightCycles && node.inCycle) {
        cycleClassNodes.push(mId);
      } else {
        fileClassNodes.push(mId);
      }
    }
  }

  lines.push('');

  // Collect edges
  const edges = graph.edges
    .filter((e) => {
      if (!validNodeIds.has(e.sourceFile) || !validNodeIds.has(e.target)) return false;
      if (!includeExternal && e.kind === 'external') return false;
      return true;
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const edge of edges) {
    const sourceMId = toMermaidId(edge.sourceFile);
    const targetMId = toMermaidId(edge.target);

    if (edge.kind === 'external') {
      lines.push(`  ${sourceMId} -.->|depends on| ${targetMId}`);
    } else {
      lines.push(`  ${sourceMId} -->|imports| ${targetMId}`);
    }
  }

  // Styles
  lines.push('');
  lines.push('  classDef fileNode fill:#18181b,stroke:#3b82f6,stroke-width:1.5px,color:#f8fafc;');
  lines.push('  classDef pkgNode fill:#2e1065,stroke:#a855f7,stroke-width:1.5px,color:#f3e8ff;');
  lines.push('  classDef cycleNode fill:#881337,stroke:#f43f5e,stroke-width:2px,color:#ffe4e6;');

  if (fileClassNodes.length > 0) lines.push(`  class ${fileClassNodes.join(',')} fileNode;`);
  if (pkgClassNodes.length > 0) lines.push(`  class ${pkgClassNodes.join(',')} pkgNode;`);
  if (cycleClassNodes.length > 0) lines.push(`  class ${cycleClassNodes.join(',')} cycleNode;`);

  return lines.join('\n');
}
