import type {
  DependencyGraph,
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
