import type { CircularDependencyCycle, DependencyEdge } from '@/types/dependency';

/**
 * Deterministically detects all circular dependency cycles in an internal dependency graph.
 * Uses a DFS back-edge cycle detection algorithm with canonical rotation normalization.
 */
export function detectCircularDependencies(
  internalEdges: DependencyEdge[]
): CircularDependencyCycle[] {
  const adj = new Map<string, string[]>();
  const edgeMap = new Map<string, string>(); // "source->target" -> edgeId

  // Build adjacency list and edge lookup
  for (const edge of internalEdges) {
    if (edge.kind !== 'internal') continue;
    if (edge.sourceFile === edge.target) continue; // Ignore self-imports if any

    let neighbors = adj.get(edge.sourceFile);
    if (!neighbors) {
      neighbors = [];
      adj.set(edge.sourceFile, neighbors);
    }
    if (!neighbors.includes(edge.target)) {
      neighbors.push(edge.target);
    }

    edgeMap.set(`${edge.sourceFile}->${edge.target}`, edge.id);
  }

  // Sort adjacency list neighbors for deterministic traversal
  for (const neighbors of adj.values()) {
    neighbors.sort();
  }

  const allNodes = Array.from(adj.keys()).sort();
  const canonicalCycles = new Map<string, string[]>();

  const visited = new Set<string>();
  const recursionStack: string[] = [];
  const stackPos = new Map<string, number>();

  const dfs = (node: string) => {
    visited.add(node);
    stackPos.set(node, recursionStack.length);
    recursionStack.push(node);

    const neighbors = adj.get(node) || [];
    for (const next of neighbors) {
      if (stackPos.has(next)) {
        // Back-edge found: cycle exists
        const cycleStartIndex = stackPos.get(next)!;
        const cycleNodes = recursionStack.slice(cycleStartIndex);
        cycleNodes.push(next); // Close the cycle loop

        const canonical = canonicalizeCycle(cycleNodes);
        const cycleKey = canonical.join('->');
        if (!canonicalCycles.has(cycleKey)) {
          canonicalCycles.set(cycleKey, canonical);
        }
      } else if (!visited.has(next)) {
        dfs(next);
      }
    }

    recursionStack.pop();
    stackPos.delete(node);
  };

  for (const node of allNodes) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  // Convert canonical cycles to CircularDependencyCycle objects
  const result: CircularDependencyCycle[] = [];
  let cycleCounter = 1;

  for (const cycleFiles of canonicalCycles.values()) {
    const cycleEdges: string[] = [];
    for (let i = 0; i < cycleFiles.length - 1; i++) {
      const u = cycleFiles[i];
      const v = cycleFiles[i + 1];
      const edgeId = edgeMap.get(`${u}->${v}`);
      if (edgeId) {
        cycleEdges.push(edgeId);
      }
    }

    result.push({
      id: `cycle-${cycleCounter++}`,
      files: cycleFiles,
      edgeIds: cycleEdges,
    });
  }

  return result.sort((a, b) => a.files.join('->').localeCompare(b.files.join('->')));
}

/**
 * Normalizes a cycle so that it always starts and ends with its lexicographically smallest node.
 * E.g. [B, C, A, B] -> [A, B, C, A]
 */
function canonicalizeCycle(cycleWithLoop: string[]): string[] {
  const nodes = cycleWithLoop.slice(0, -1);
  if (nodes.length <= 1) return cycleWithLoop;

  // Find index of lexicographical minimum node
  let minIndex = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i] < nodes[minIndex]) {
      minIndex = i;
    }
  }

  // Rotate
  const rotated = [...nodes.slice(minIndex), ...nodes.slice(0, minIndex)];
  rotated.push(rotated[0]); // Re-close the loop
  return rotated;
}
