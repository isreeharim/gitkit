import type {
  DependencyGraph,
  SerializedDependencyGraph,
  DependencyNode,
  DependencyEdge,
  FileDependencyNode,
  PackageDependencyNode,
  PackageDependency,
  ImportStatement,
  DependencyGraphStats,
} from '@/types/dependency';
import { resolveModuleSpecifier } from './resolver';
import { detectCircularDependencies } from './cycle-detector';
import { getLanguageForFile } from '../parser';

export interface GraphBuilderInput {
  parsedFiles: Map<string, ImportStatement[]>;
  allRepoPaths: Set<string>;
  manifests?: PackageDependency[];
}

/**
 * Deterministically constructs a normalized repository DependencyGraph from parsed source files,
 * manifests, and the repository file tree index.
 */
export function buildDependencyGraph(input: GraphBuilderInput): DependencyGraph {
  const { parsedFiles, allRepoPaths, manifests = [] } = input;

  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];
  const internalEdges: DependencyEdge[] = [];

  // Track degrees: node ID -> count
  const inDegreeMap = new Map<string, number>();
  const outDegreeMap = new Map<string, number>();

  const incInDegree = (id: string) => {
    inDegreeMap.set(id, (inDegreeMap.get(id) || 0) + 1);
  };
  const incOutDegree = (id: string) => {
    outDegreeMap.set(id, (outDegreeMap.get(id) || 0) + 1);
  };

  // Manifest package lookup: packageName -> PackageDependency
  const manifestPackageMap = new Map<string, PackageDependency>();
  for (const pkg of manifests) {
    manifestPackageMap.set(pkg.name, pkg);
  }

  // 1. Process all parsed source files and their import statements
  let edgeCounter = 1;
  const externalPackagesUsed = new Set<string>();

  for (const [sourceFile, importStatements] of parsedFiles.entries()) {
    for (const statement of importStatements) {
      const resolution = resolveModuleSpecifier(statement.specifier, sourceFile, allRepoPaths);

      const edgeId = `dep-${edgeCounter++}`;
      const edge: DependencyEdge = {
        id: edgeId,
        sourceFile,
        rawSpecifier: statement.specifier,
        target: resolution.target,
        kind: resolution.kind,
        importedSymbols: statement.importedSymbols,
        isTypeOnly: statement.isTypeOnly,
        isDynamic: statement.isDynamic,
        line: statement.line,
      };

      edges.push(edge);

      // Degree tracking
      incOutDegree(`file:${sourceFile}`);
      if (resolution.kind === 'internal') {
        incInDegree(`file:${resolution.target}`);
        internalEdges.push(edge);
      } else if (resolution.kind === 'external') {
        incInDegree(`pkg:${resolution.target}`);
        externalPackagesUsed.add(resolution.target);
      } else {
        incInDegree(`unresolved:${resolution.target}`);
      }
    }
  }

  // 2. Detect circular dependencies across internal edges
  const cycles = detectCircularDependencies(internalEdges);

  // Map file paths to cycle IDs
  const fileToCyclesMap = new Map<string, string[]>();
  for (const cycle of cycles) {
    // Unique files in cycle (omit last repeating node)
    const uniqueFiles = new Set(cycle.files.slice(0, -1));
    for (const file of uniqueFiles) {
      let list = fileToCyclesMap.get(file);
      if (!list) {
        list = [];
        fileToCyclesMap.set(file, list);
      }
      list.push(cycle.id);
    }
  }

  // 3. Create FileDependencyNodes for all known source files in the repository
  const fileNodesSet = new Set<string>();
  // Include all files that were parsed or appear as internal targets
  for (const sourceFile of parsedFiles.keys()) {
    fileNodesSet.add(sourceFile);
  }
  for (const edge of internalEdges) {
    fileNodesSet.add(edge.target);
  }

  for (const filePath of fileNodesSet) {
    const fileId = `file:${filePath}`;
    const cycleIds = fileToCyclesMap.get(filePath) || [];
    const isAnalyzed = parsedFiles.has(filePath);
    const fileName = filePath.split('/').pop() || filePath;

    const fileNode: FileDependencyNode = {
      id: fileId,
      type: 'file',
      path: filePath,
      name: fileName,
      language: getLanguageForFile(filePath),
      isAnalyzed,
      inDegree: inDegreeMap.get(fileId) || 0,
      outDegree: outDegreeMap.get(fileId) || 0,
      inCycle: cycleIds.length > 0,
      cycleIds,
    };

    nodes.set(fileId, fileNode);
  }

  // 4. Create PackageDependencyNodes
  // Combine packages declared in manifests AND packages imported in source code
  const allPackageNames = new Set<string>([
    ...Array.from(externalPackagesUsed),
    ...Array.from(manifestPackageMap.keys()),
  ]);

  for (const pkgName of allPackageNames) {
    const pkgId = `pkg:${pkgName}`;
    const manifestInfo = manifestPackageMap.get(pkgName);

    const pkgNode: PackageDependencyNode = {
      id: pkgId,
      type: 'package',
      name: pkgName,
      ecosystem: manifestInfo?.ecosystem || 'npm',
      versionConstraint: manifestInfo?.versionConstraint,
      isDev: manifestInfo?.isDev ?? false,
      manifestSource: manifestInfo?.manifestSource,
      isUnresolved: !manifestInfo,
    };

    nodes.set(pkgId, pkgNode);
  }

  // 5. Compute graph statistics
  let internalCount = 0;
  let externalCount = 0;
  let unresolvedCount = 0;

  for (const edge of edges) {
    if (edge.kind === 'internal') internalCount++;
    else if (edge.kind === 'external') externalCount++;
    else unresolvedCount++;
  }

  let devCount = 0;
  let uniquePkgCount = 0;
  for (const node of nodes.values()) {
    if (node.type === 'package') {
      uniquePkgCount++;
      if (node.isDev) devCount++;
    }
  }

  const stats: DependencyGraphStats = {
    totalFiles: fileNodesSet.size,
    analyzedFiles: parsedFiles.size,
    internalEdges: internalCount,
    externalEdges: externalCount,
    unresolvedEdges: unresolvedCount,
    circularCyclesCount: cycles.length,
    uniquePackagesCount: uniquePkgCount,
    devPackagesCount: devCount,
  };

  return {
    nodes,
    edges,
    cycles,
    packages: manifests,
    stats,
  };
}

/**
 * Converts a DependencyGraph with Map nodes into a JSON-serializable SerializedDependencyGraph.
 */
export function serializeDependencyGraph(graph: DependencyGraph): SerializedDependencyGraph {
  return {
    nodesList: Array.from(graph.nodes.values()),
    edges: graph.edges,
    cycles: graph.cycles,
    packages: graph.packages,
    stats: graph.stats,
  };
}

/**
 * Deterministically reconstructs a full DependencyGraph with Map nodes from any format
 * (DependencyGraph, SerializedDependencyGraph, or JSON-hydrated object).
 */
export function ensureDependencyGraph(raw: unknown): DependencyGraph {
  if (!raw || typeof raw !== 'object') {
    return {
      nodes: new Map(),
      edges: [],
      cycles: [],
      packages: [],
      stats: {
        totalFiles: 0,
        analyzedFiles: 0,
        internalEdges: 0,
        externalEdges: 0,
        unresolvedEdges: 0,
        circularCyclesCount: 0,
        uniquePackagesCount: 0,
        devPackagesCount: 0,
      },
    };
  }

  const rawObj = raw as {
    nodes?: Map<string, DependencyNode> | Record<string, DependencyNode> | DependencyNode[];
    nodesList?: DependencyNode[];
    edges?: DependencyEdge[];
    cycles?: import('@/types/dependency').CircularDependencyCycle[];
    packages?: PackageDependency[];
    stats?: DependencyGraphStats;
  };

  const nodesMap = new Map<string, DependencyNode>();

  if (rawObj.nodes instanceof Map) {
    for (const [id, node] of rawObj.nodes.entries()) {
      nodesMap.set(id, node);
    }
  } else if (Array.isArray(rawObj.nodesList)) {
    for (const node of rawObj.nodesList) {
      if (node && node.id) {
        nodesMap.set(node.id, node);
      }
    }
  } else if (Array.isArray(rawObj.nodes)) {
    for (const node of rawObj.nodes) {
      if (node && node.id) {
        nodesMap.set(node.id, node);
      }
    }
  } else if (rawObj.nodes && typeof rawObj.nodes === 'object') {
    for (const [id, node] of Object.entries(rawObj.nodes)) {
      if (node && (node as DependencyNode).id) {
        nodesMap.set(id, node as DependencyNode);
      }
    }
  }

  // Failsafe: if nodesMap is still empty, reconstruct nodes from packages and edges
  if (nodesMap.size === 0) {
    if (Array.isArray(rawObj.packages)) {
      for (const pkg of rawObj.packages) {
        const pkgId = `pkg:${pkg.name}`;
        nodesMap.set(pkgId, {
          id: pkgId,
          type: 'package',
          name: pkg.name,
          ecosystem: pkg.ecosystem || 'npm',
          versionConstraint: pkg.versionConstraint,
          isDev: pkg.isDev ?? false,
          manifestSource: pkg.manifestSource,
          isUnresolved: false,
        });
      }
    }

    if (Array.isArray(rawObj.edges)) {
      for (const edge of rawObj.edges) {
        const fileId = `file:${edge.sourceFile}`;
        if (!nodesMap.has(fileId)) {
          nodesMap.set(fileId, {
            id: fileId,
            type: 'file',
            path: edge.sourceFile,
            name: edge.sourceFile.split('/').pop() || edge.sourceFile,
            language: getLanguageForFile(edge.sourceFile),
            isAnalyzed: true,
            inDegree: 0,
            outDegree: 0,
            inCycle: false,
            cycleIds: [],
          });
        }
        if (edge.kind === 'internal') {
          const targetFileId = `file:${edge.target}`;
          if (!nodesMap.has(targetFileId)) {
            nodesMap.set(targetFileId, {
              id: targetFileId,
              type: 'file',
              path: edge.target,
              name: edge.target.split('/').pop() || edge.target,
              language: getLanguageForFile(edge.target),
              isAnalyzed: false,
              inDegree: 0,
              outDegree: 0,
              inCycle: false,
              cycleIds: [],
            });
          }
        } else if (edge.kind === 'external') {
          const targetPkgId = `pkg:${edge.target}`;
          if (!nodesMap.has(targetPkgId)) {
            nodesMap.set(targetPkgId, {
              id: targetPkgId,
              type: 'package',
              name: edge.target,
              ecosystem: 'npm',
              isDev: false,
              isUnresolved: true,
            });
          }
        }
      }
    }
  }

  return {
    nodes: nodesMap,
    edges: Array.isArray(rawObj.edges) ? rawObj.edges : [],
    cycles: Array.isArray(rawObj.cycles) ? rawObj.cycles : [],
    packages: Array.isArray(rawObj.packages) ? rawObj.packages : [],
    stats: rawObj.stats || {
      totalFiles: 0,
      analyzedFiles: 0,
      internalEdges: 0,
      externalEdges: 0,
      unresolvedEdges: 0,
      circularCyclesCount: 0,
      uniquePackagesCount: 0,
      devPackagesCount: 0,
    },
  };
}
