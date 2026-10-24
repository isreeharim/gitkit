import type {
  PullRequestDetail,
  DirectoryImpactSummary,
  AffectedModuleImpact,
  PullRequestImpactReport,
} from '@/types/pull-request';
import type { DependencyGraph } from '@/types/dependency';

export const PR_IMPACT_DISCLAIMER =
  'Potentially affected modules based on deterministic dependency graph traversal. Does not imply runtime failure or bug causation.';

export interface ImpactAnalyzerOptions {
  maxTransitiveDepth?: number;
  largestFilesLimit?: number;
}

/**
 * Deterministically analyzes the blast radius and downstream dependency impact of a Pull Request.
 */
export function analyzePullRequestImpact(
  repoId: string,
  pr: PullRequestDetail,
  graph?: DependencyGraph,
  options: ImpactAnalyzerOptions = {}
): PullRequestImpactReport {
  const maxDepth = options.maxTransitiveDepth ?? 3;
  const largestFilesLimit = options.largestFilesLimit ?? 10;

  const totalFilesChanged = pr.files.length;
  const totalAdditions = pr.files.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = pr.files.reduce((sum, f) => sum + f.deletions, 0);
  const netGrowth = totalAdditions - totalDeletions;
  const totalVolume = totalAdditions + totalDeletions;

  // 1. Directory Churn Breakdown
  const dirMap = new Map<
    string,
    { directory: string; count: number; additions: number; deletions: number; total: number }
  >();

  const fileTypeMap: Record<string, number> = {};

  for (const file of pr.files) {
    const parts = file.path.split('/');
    const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '.';

    const existing = dirMap.get(dir) || {
      directory: dir,
      count: 0,
      additions: 0,
      deletions: 0,
      total: 0,
    };

    existing.count += 1;
    existing.additions += file.additions;
    existing.deletions += file.deletions;
    existing.total += file.changes;
    dirMap.set(dir, existing);

    // File type extension
    const ext = file.path.includes('.')
      ? `.${file.path.split('.').pop()?.toLowerCase()}`
      : 'no_extension';
    fileTypeMap[ext] = (fileTypeMap[ext] || 0) + 1;
  }

  const affectedDirectories: DirectoryImpactSummary[] = Array.from(dirMap.values())
    .map((d) => ({
      directory: d.directory,
      changedFilesCount: d.count,
      additions: d.additions,
      deletions: d.deletions,
      totalChanges: d.total,
      percentageOfChanges: totalVolume > 0 ? Math.round((d.total / totalVolume) * 100) : 0,
    }))
    .sort((a, b) => b.totalChanges - a.totalChanges || a.directory.localeCompare(b.directory));

  // Top directory concentration
  const topDirectory = affectedDirectories[0]?.directory || '.';
  const topDirectoryPercentage = affectedDirectories[0]?.percentageOfChanges || 0;

  // 2. Largest Changed Files
  const largestChangedFiles = pr.files
    .slice()
    .sort((a, b) => b.changes - a.changes || a.path.localeCompare(b.path))
    .slice(0, largestFilesLimit);

  // 3. Dependency Impact Traversal
  const directDependenciesSet = new Set<string>();
  const affectedModules: AffectedModuleImpact[] = [];
  const changedPathSet = new Set(pr.files.map((f) => f.path));

  if (graph) {
    // Build reverse adjacency list: target -> sources that import target
    const reverseAdjacency = new Map<string, string[]>();
    // Forward adjacency list: source -> targets imported
    const forwardAdjacency = new Map<string, string[]>();

    for (const edge of graph.edges) {
      // Forward
      const fwd = forwardAdjacency.get(edge.sourceFile) || [];
      fwd.push(edge.target);
      forwardAdjacency.set(edge.sourceFile, fwd);

      // Reverse
      const rev = reverseAdjacency.get(edge.target) || [];
      rev.push(edge.sourceFile);
      reverseAdjacency.set(edge.target, rev);
    }

    // Direct dependencies: things imported by the changed files
    for (const changedPath of changedPathSet) {
      const outgoing = forwardAdjacency.get(changedPath) || [];
      for (const target of outgoing) {
        directDependenciesSet.add(target);
      }
    }

    // Traverse downstream dependents via BFS
    // Queue stores: { path, depth, rootChangedPath }
    const queue: Array<{ path: string; depth: number; rootChangedPath: string }> = [];
    const visited = new Set<string>();

    for (const changedPath of changedPathSet) {
      // Check if this file exists in graph
      visited.add(changedPath);
      affectedModules.push({
        path: changedPath,
        name: changedPath.split('/').pop() || changedPath,
        isDirectlyChanged: true,
        depth: 0,
        reason: 'Directly modified in this Pull Request',
      });

      // Seed immediate dependents
      const dependents = reverseAdjacency.get(changedPath) || [];
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push({ path: dep, depth: 1, rootChangedPath: changedPath });
        }
      }
    }

    // Process BFS queue up to maxDepth
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth > maxDepth) continue;

      const name = current.path.split('/').pop() || current.path;
      const isDirect = current.depth === 1;

      affectedModules.push({
        path: current.path,
        name,
        isDirectlyChanged: false,
        depth: current.depth,
        importedByDirectPath: current.rootChangedPath,
        reason: isDirect
          ? `Directly imports modified module "${current.rootChangedPath}"`
          : `Transitively depends on "${current.rootChangedPath}" at depth ${current.depth}`,
      });

      if (current.depth < maxDepth) {
        const nextDependents = reverseAdjacency.get(current.path) || [];
        for (const next of nextDependents) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push({
              path: next,
              depth: current.depth + 1,
              rootChangedPath: current.rootChangedPath,
            });
          }
        }
      }
    }
  } else {
    // When graph is not provided, only list directly changed files as affected
    for (const file of pr.files) {
      affectedModules.push({
        path: file.path,
        name: file.path.split('/').pop() || file.path,
        isDirectlyChanged: true,
        depth: 0,
        reason: 'Directly modified in this Pull Request',
      });
    }
  }

  // Sort affected modules: depth ascending, then path alphabetically
  affectedModules.sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path));

  return {
    repoId,
    pr,
    totalFilesChanged,
    totalAdditions,
    totalDeletions,
    netGrowth,
    affectedDirectories,
    largestChangedFiles,
    directDependencies: Array.from(directDependenciesSet).sort(),
    affectedModules,
    totalAffectedModulesCount: affectedModules.length,
    changeConcentration: {
      topDirectory,
      topDirectoryPercentage,
      fileTypeDistribution: fileTypeMap,
    },
    disclaimer: PR_IMPACT_DISCLAIMER,
  };
}
