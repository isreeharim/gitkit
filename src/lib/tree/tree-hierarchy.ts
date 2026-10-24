import type { RepositoryTreeEntry, TreeEntryType } from '@/types/repository';

export interface FileTreeNode {
  name: string;
  path: string;
  type: TreeEntryType;
  size?: number;
  sha?: string;
  children: FileTreeNode[];
  fileCount: number;
}

/**
 * Deterministically constructs a sorted hierarchical folder tree from flat Git tree entries.
 */
export function buildFileTreeHierarchy(entries: RepositoryTreeEntry[]): FileTreeNode[] {
  const rootNodes: FileTreeNode[] = [];
  const nodeMap = new Map<string, FileTreeNode>();

  // Ensure entries are uniquely identified by path
  const sortedEntries = [...entries].sort((a, b) => a.path.localeCompare(b.path));

  for (const entry of sortedEntries) {
    if (!entry.path) continue;
    const parts = entry.path.split('/');
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      let existing = nodeMap.get(currentPath);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          type: isLast ? entry.type : 'tree',
          size: isLast ? entry.size : undefined,
          sha: isLast ? entry.sha : undefined,
          children: [],
          fileCount: isLast && entry.type === 'blob' ? 1 : 0,
        };

        nodeMap.set(currentPath, existing);

        if (parentPath) {
          const parent = nodeMap.get(parentPath);
          if (parent) {
            parent.children.push(existing);
          }
        } else {
          rootNodes.push(existing);
        }
      } else if (isLast) {
        // If directory was auto-created before visiting explicit entry
        existing.type = entry.type;
        existing.size = entry.size;
        existing.sha = entry.sha;
      }
    }
  }

  // Recursive post-order function to calculate counts and sort (directories first, then alphabetical)
  function finalizeNode(node: FileTreeNode): number {
    let count = node.type === 'blob' ? 1 : 0;

    for (const child of node.children) {
      count += finalizeNode(child);
    }

    node.fileCount = count;

    // Sort children: folders first, then alphabetical
    node.children.sort((a, b) => {
      const aIsDir = a.type === 'tree';
      const bIsDir = b.type === 'tree';
      if (aIsDir && !bIsDir) return -1;
      if (!aIsDir && bIsDir) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });

    return count;
  }

  for (const root of rootNodes) {
    finalizeNode(root);
  }

  rootNodes.sort((a, b) => {
    const aIsDir = a.type === 'tree';
    const bIsDir = b.type === 'tree';
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });

  return rootNodes;
}
