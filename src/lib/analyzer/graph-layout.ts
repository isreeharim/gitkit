import type { DependencyNode, DependencyEdge } from '@/types/dependency';

export interface DependencyLayoutPosition {
  readonly x: number;
  readonly y: number;
}

export interface DependencyLayoutOptions {
  fileNodeWidth?: number;
  fileNodeHeight?: number;
  packageNodeWidth?: number;
  packageNodeHeight?: number;
  columnGap?: number;
  rowGap?: number;
}

const DEFAULT_OPTIONS: Required<DependencyLayoutOptions> = {
  fileNodeWidth: 260,
  fileNodeHeight: 90,
  packageNodeWidth: 220,
  packageNodeHeight: 75,
  columnGap: 120,
  rowGap: 40,
};

/**
 * Computes deterministic 2D layout coordinates for visible dependency graph nodes.
 * Arranges internal source files into layered topological columns and groups
 * external package dependencies in an aligned column to the right.
 */
export function computeDependencyLayout(
  nodes: DependencyNode[],
  _edges: DependencyEdge[],
  options: DependencyLayoutOptions = {}
): Map<string, DependencyLayoutPosition> {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const positions = new Map<string, DependencyLayoutPosition>();

  // Separate files and packages
  const fileNodes = nodes.filter((n) => n.type === 'file');
  const packageNodes = nodes.filter((n) => n.type === 'package');

  // Sort files deterministically: root/shallow depth first, then alphabetical
  fileNodes.sort((a, b) => {
    const depthA = a.path.split('/').length;
    const depthB = b.path.split('/').length;
    if (depthA !== depthB) return depthA - depthB;
    return a.path.localeCompare(b.path);
  });

  // Assign columns based on directory depth / topological level
  const columns = new Map<number, string[]>();
  const fileColMap = new Map<string, number>();

  for (const file of fileNodes) {
    const depth = Math.min(file.path.split('/').length - 1, 4); // Limit max column depth to 4
    fileColMap.set(file.id, depth);

    let list = columns.get(depth);
    if (!list) {
      list = [];
      columns.set(depth, list);
    }
    list.push(file.id);
  }

  // Calculate coordinates for file nodes
  let maxColIndex = 0;
  for (const [colIndex, nodeIds] of columns.entries()) {
    if (colIndex > maxColIndex) maxColIndex = colIndex;
    const x = colIndex * (config.fileNodeWidth + config.columnGap);

    let currentY = 0;
    for (const nodeId of nodeIds) {
      positions.set(nodeId, { x, y: currentY });
      currentY += config.fileNodeHeight + config.rowGap;
    }
  }

  // Package nodes column placed to the right of files
  const packageColX = (maxColIndex + 1) * (config.fileNodeWidth + config.columnGap) + 40;
  packageNodes.sort((a, b) => a.name.localeCompare(b.name));

  let packageY = 0;
  for (const pkg of packageNodes) {
    positions.set(pkg.id, { x: packageColX, y: packageY });
    packageY += config.packageNodeHeight + config.rowGap;
  }

  return positions;
}
