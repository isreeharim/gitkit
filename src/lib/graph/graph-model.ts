/**
 * Core node types in GitKit's internal repository graph.
 */
export type RepoGraphNodeType = 'repository' | 'directory' | 'file';

/**
 * Edge relationship types in GitKit's internal repository graph.
 */
export type RepoGraphEdgeType = 'CONTAINS';

/**
 * Base graph node interface decoupled from any rendering framework.
 */
export interface BaseGraphNode {
  readonly id: string;
  readonly type: RepoGraphNodeType;
  readonly name: string;
  readonly path: string;
  readonly depth: number;
  readonly parentId: string | null;
  readonly childIds: string[];
}

/**
 * Root repository node.
 */
export interface RepositoryGraphNode extends BaseGraphNode {
  readonly type: 'repository';
  readonly owner: string;
  readonly repo: string;
  readonly defaultBranch: string;
  readonly totalFiles: number;
  readonly totalDirectories: number;
  readonly totalBytes: number;
  readonly stars: number;
  readonly language: string | null;
}

/**
 * Directory container node.
 */
export interface DirectoryGraphNode extends BaseGraphNode {
  readonly type: 'directory';
  readonly childFileCount: number;
  readonly childDirectoryCount: number;
  readonly totalDescendantFiles: number;
  readonly totalDescendantBytes: number;
}

/**
 * File leaf node.
 */
export interface FileGraphNode extends BaseGraphNode {
  readonly type: 'file';
  readonly size: number;
  readonly extension: string;
  readonly sha: string;
}

/**
 * Union of all graph nodes.
 */
export type RepoGraphNode = RepositoryGraphNode | DirectoryGraphNode | FileGraphNode;

/**
 * Graph edge representing hierarchy or containment.
 */
export interface RepoGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly type: RepoGraphEdgeType;
}

/**
 * Positioned layout coordinates for a node.
 */
export interface NodeLayoutPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Complete normalized repository graph representation.
 */
export interface RepoGraph {
  readonly rootId: string;
  readonly nodes: Map<string, RepoGraphNode>;
  readonly edges: RepoGraphEdge[];
  readonly adjacencyList: Map<string, string[]>;
}
