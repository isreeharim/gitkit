/**
 * Supported programming languages for deterministic source parsing.
 */
export type SourceLanguage = 'javascript' | 'typescript' | 'jsx' | 'tsx' | 'python' | 'unsupported';

/**
 * Single import statement extracted from a source file.
 */
export interface ImportStatement {
  readonly specifier: string;
  readonly importedSymbols: string[];
  readonly isTypeOnly: boolean;
  readonly isDynamic: boolean;
  readonly line: number;
  readonly column?: number;
}

/**
 * Dependency relationship edge kind.
 */
export type DependencyEdgeKind = 'internal' | 'external' | 'unresolved';

/**
 * Rich dependency edge connecting a source file to an internal file or external package.
 */
export interface DependencyEdge {
  readonly id: string;
  readonly sourceFile: string;
  readonly rawSpecifier: string;
  readonly target: string;
  readonly kind: DependencyEdgeKind;
  readonly importedSymbols: string[];
  readonly isTypeOnly: boolean;
  readonly isDynamic: boolean;
  readonly line: number;
}

/**
 * Ecosystem kind for third-party packages.
 */
export type PackageEcosystem = 'npm' | 'pypi' | 'cargo' | 'gomod' | 'unknown';

/**
 * Package dependency parsed from project manifests.
 */
export interface PackageDependency {
  readonly name: string;
  readonly versionConstraint: string;
  readonly isDev: boolean;
  readonly manifestSource: string;
  readonly ecosystem: PackageEcosystem;
}

/**
 * File node in the dependency graph.
 */
export interface FileDependencyNode {
  readonly id: string;
  readonly type: 'file';
  readonly path: string;
  readonly name: string;
  readonly language: SourceLanguage;
  readonly isAnalyzed: boolean;
  readonly inDegree: number;
  readonly outDegree: number;
  readonly inCycle: boolean;
  readonly cycleIds: string[];
}

/**
 * Package node in the dependency graph.
 */
export interface PackageDependencyNode {
  readonly id: string;
  readonly type: 'package';
  readonly name: string;
  readonly ecosystem: PackageEcosystem;
  readonly versionConstraint?: string;
  readonly isDev?: boolean;
  readonly manifestSource?: string;
  readonly isUnresolved?: boolean;
}

/**
 * Union of all nodes in the dependency graph.
 */
export type DependencyNode = FileDependencyNode | PackageDependencyNode;

/**
 * Circular dependency chain represented as an ordered sequence of file paths.
 */
export interface CircularDependencyCycle {
  readonly id: string;
  readonly files: string[];
  readonly edgeIds: string[];
}

/**
 * Aggregated metrics and summary stats for a dependency graph.
 */
export interface DependencyGraphStats {
  readonly totalFiles: number;
  readonly analyzedFiles: number;
  readonly internalEdges: number;
  readonly externalEdges: number;
  readonly unresolvedEdges: number;
  readonly circularCyclesCount: number;
  readonly uniquePackagesCount: number;
  readonly devPackagesCount: number;
}

/**
 * Complete normalized repository dependency graph representation.
 */
export interface DependencyGraph {
  readonly nodes: Map<string, DependencyNode>;
  readonly edges: DependencyEdge[];
  readonly cycles: CircularDependencyCycle[];
  readonly packages: PackageDependency[];
  readonly stats: DependencyGraphStats;
}
