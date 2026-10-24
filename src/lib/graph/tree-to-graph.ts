import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import type {
  RepoGraph,
  RepoGraphNode,
  RepoGraphEdge,
  RepositoryGraphNode,
  DirectoryGraphNode,
  FileGraphNode,
} from './graph-model';

/**
 * Creates deterministic node IDs.
 */
export function createRepoNodeId(owner: string, repo: string): string {
  return `repo:${owner}/${repo}`;
}

export function createDirNodeId(path: string): string {
  return `dir:${path}`;
}

export function createFileNodeId(path: string): string {
  return `file:${path}`;
}

export function createEdgeId(source: string, target: string): string {
  return `edge:${source}->${target}`;
}

/**
 * Deterministically constructs a normalized repository graph from metadata and tree.
 */
export function buildRepositoryGraph(
  metadata: RepositoryMetadata,
  tree: RepositoryTree
): RepoGraph {
  const rootId = createRepoNodeId(metadata.owner, metadata.name);
  const nodes = new Map<string, RepoGraphNode>();
  const edges: RepoGraphEdge[] = [];
  const adjacencyList = new Map<string, string[]>();

  const getOrCreateChildIds = (id: string): string[] => {
    let list = adjacencyList.get(id);
    if (!list) {
      list = [];
      adjacencyList.set(id, list);
    }
    return list;
  };

  // 1. Create root node
  const rootNode: RepositoryGraphNode = {
    id: rootId,
    type: 'repository',
    name: metadata.name,
    path: '',
    depth: 0,
    parentId: null,
    childIds: [],
    owner: metadata.owner,
    repo: metadata.name,
    defaultBranch: metadata.defaultBranch,
    totalFiles: tree.totalFiles,
    totalDirectories: tree.totalDirectories,
    totalBytes: tree.totalBytes,
    stars: metadata.stars,
    language: metadata.language,
  };

  nodes.set(rootId, rootNode);
  adjacencyList.set(rootId, []);

  // Helper to ensure intermediate directory nodes exist
  const ensureDirectoryNode = (dirPath: string): string => {
    const dirId = createDirNodeId(dirPath);
    if (nodes.has(dirId)) {
      return dirId;
    }

    const pathSegments = dirPath.split('/');
    const dirName = pathSegments[pathSegments.length - 1];
    const depth = pathSegments.length;

    let parentId: string;
    if (pathSegments.length === 1) {
      parentId = rootId;
    } else {
      const parentPath = pathSegments.slice(0, -1).join('/');
      parentId = ensureDirectoryNode(parentPath);
    }

    const dirNode: DirectoryGraphNode = {
      id: dirId,
      type: 'directory',
      name: dirName,
      path: dirPath,
      depth,
      parentId,
      childIds: [],
      childFileCount: 0,
      childDirectoryCount: 0,
      totalDescendantFiles: 0,
      totalDescendantBytes: 0,
    };

    nodes.set(dirId, dirNode);

    // Register with parent
    const parentChildren = getOrCreateChildIds(parentId);
    if (!parentChildren.includes(dirId)) {
      parentChildren.push(dirId);
      edges.push({
        id: createEdgeId(parentId, dirId),
        source: parentId,
        target: dirId,
        type: 'CONTAINS',
      });
    }

    return dirId;
  };

  // 2. Process all tree entries
  for (const entry of tree.entries) {
    if (!entry.path) continue;

    const segments = entry.path.split('/');
    const fileName = segments[segments.length - 1];

    if (entry.type === 'tree') {
      ensureDirectoryNode(entry.path);
    } else if (entry.type === 'blob' || entry.type === 'submodule' || entry.type === 'other') {
      let parentId: string;
      if (segments.length === 1) {
        parentId = rootId;
      } else {
        const parentPath = segments.slice(0, -1).join('/');
        parentId = ensureDirectoryNode(parentPath);
      }

      const fileId = createFileNodeId(entry.path);
      const dotIndex = fileName.lastIndexOf('.');
      const extension = dotIndex !== -1 ? fileName.slice(dotIndex + 1).toLowerCase() : '';

      const fileNode: FileGraphNode = {
        id: fileId,
        type: 'file',
        name: fileName,
        path: entry.path,
        depth: segments.length,
        parentId,
        childIds: [],
        size: entry.size ?? 0,
        extension,
        sha: entry.sha,
      };

      nodes.set(fileId, fileNode);

      const parentChildren = getOrCreateChildIds(parentId);
      if (!parentChildren.includes(fileId)) {
        parentChildren.push(fileId);
        edges.push({
          id: createEdgeId(parentId, fileId),
          source: parentId,
          target: fileId,
          type: 'CONTAINS',
        });
      }
    }
  }

  // 3. Update childIds arrays on all nodes from adjacency list
  for (const [nodeId, childIds] of adjacencyList.entries()) {
    const node = nodes.get(nodeId);
    if (node) {
      // Sort children: directories first, then alphabetical
      childIds.sort((a, b) => {
        const nodeA = nodes.get(a);
        const nodeB = nodes.get(b);
        if (nodeA?.type === 'directory' && nodeB?.type !== 'directory') return -1;
        if (nodeA?.type !== 'directory' && nodeB?.type === 'directory') return 1;
        return (nodeA?.name || '').localeCompare(nodeB?.name || '');
      });

      (node as { childIds: string[] }).childIds = childIds;
    }
  }

  // 4. Compute aggregate statistics bottom-up
  const computeStats = (nodeId: string): { descendantFiles: number; descendantBytes: number } => {
    const node = nodes.get(nodeId);
    if (!node) return { descendantFiles: 0, descendantBytes: 0 };

    if (node.type === 'file') {
      return { descendantFiles: 1, descendantBytes: node.size };
    }

    let files = 0;
    let bytes = 0;
    let directFiles = 0;
    let directDirs = 0;

    for (const childId of node.childIds) {
      const child = nodes.get(childId);
      if (!child) continue;

      if (child.type === 'directory') {
        directDirs++;
      } else {
        directFiles++;
      }

      const childStats = computeStats(childId);
      files += childStats.descendantFiles;
      bytes += childStats.descendantBytes;
    }

    if (node.type === 'directory') {
      (node as { childFileCount: number }).childFileCount = directFiles;
      (node as { childDirectoryCount: number }).childDirectoryCount = directDirs;
      (node as { totalDescendantFiles: number }).totalDescendantFiles = files;
      (node as { totalDescendantBytes: number }).totalDescendantBytes = bytes;
    }

    return { descendantFiles: files, descendantBytes: bytes };
  };

  computeStats(rootId);

  return {
    rootId,
    nodes,
    edges,
    adjacencyList,
  };
}
