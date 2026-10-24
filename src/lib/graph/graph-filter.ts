import type { RepoGraph } from './graph-model';

export interface GraphFilterOptions {
  query?: string;
  typeFilter?: 'all' | 'directory' | 'file';
  extension?: string;
}

export interface GraphFilterResult {
  matchingNodeIds: Set<string>;
  ancestorIdsToExpand: Set<string>;
  totalMatches: number;
}

/**
 * Searches and filters nodes in the graph deterministically.
 * Identifies matching nodes and all ancestor directory IDs required to reveal them.
 */
export function filterGraph(graph: RepoGraph, options: GraphFilterOptions): GraphFilterResult {
  const query = options.query?.trim().toLowerCase() || '';
  const typeFilter = options.typeFilter || 'all';
  const targetExtension = options.extension?.trim().toLowerCase().replace(/^\./, '') || '';

  const matchingNodeIds = new Set<string>();
  const ancestorIdsToExpand = new Set<string>();

  const isQueryActive = query.length > 0;
  const isTypeActive = typeFilter !== 'all';
  const isExtActive = targetExtension.length > 0;

  if (!isQueryActive && !isTypeActive && !isExtActive) {
    return {
      matchingNodeIds,
      ancestorIdsToExpand,
      totalMatches: 0,
    };
  }

  for (const node of graph.nodes.values()) {
    if (node.type === 'repository') continue;

    let matches = true;

    // Type filter
    if (isTypeActive && node.type !== typeFilter) {
      matches = false;
    }

    // Extension filter (only for files)
    if (matches && isExtActive) {
      if (node.type !== 'file' || node.extension !== targetExtension) {
        matches = false;
      }
    }

    // Query text match (matches name or full relative path)
    if (matches && isQueryActive) {
      const nameMatch = node.name.toLowerCase().includes(query);
      const pathMatch = node.path.toLowerCase().includes(query);
      if (!nameMatch && !pathMatch) {
        matches = false;
      }
    }

    if (matches) {
      matchingNodeIds.add(node.id);

      // Collect all parent directories up to root
      let parentId = node.parentId;
      while (parentId) {
        ancestorIdsToExpand.add(parentId);
        const parentNode = graph.nodes.get(parentId);
        parentId = parentNode?.parentId || null;
      }
    }
  }

  return {
    matchingNodeIds,
    ancestorIdsToExpand,
    totalMatches: matchingNodeIds.size,
  };
}

/**
 * Extracts a unique, sorted list of all file extensions present in the graph.
 */
export function getAvailableExtensions(graph: RepoGraph): string[] {
  const extensions = new Set<string>();

  for (const node of graph.nodes.values()) {
    if (node.type === 'file' && node.extension) {
      extensions.add(node.extension);
    }
  }

  return Array.from(extensions).sort();
}
