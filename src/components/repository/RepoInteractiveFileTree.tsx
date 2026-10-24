import { useState, useMemo, useCallback } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  ChevronRight,
  GitCommit,
  Search,
  X,
  ExternalLink,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';
import type { RepositoryTree, TreeEntryType } from '@/types/repository';
import { buildFileTreeHierarchy, type FileTreeNode } from '@/lib/tree/tree-hierarchy';
import { formatBytes } from '@/lib/utils';

interface RepoInteractiveFileTreeProps {
  owner: string;
  repo: string;
  defaultBranch: string;
  tree: RepositoryTree;
}

function getFileIcon(filename: string, type: TreeEntryType) {
  if (type === 'submodule') {
    return <GitCommit className="h-4 w-4 shrink-0 text-purple-400" />;
  }

  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return <FileCode className="h-4 w-4 shrink-0 text-emerald-400" />;
    case 'py':
    case 'rs':
    case 'go':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h':
      return <FileCode className="h-4 w-4 shrink-0 text-sky-400" />;
    case 'astro':
    case 'vue':
    case 'svelte':
    case 'html':
    case 'css':
    case 'scss':
      return <FileCode className="h-4 w-4 shrink-0 text-amber-400" />;
    case 'json':
    case 'yaml':
    case 'yml':
    case 'toml':
    case 'xml':
      return <FileText className="h-4 w-4 shrink-0 text-amber-300" />;
    case 'md':
    case 'txt':
    case 'rst':
      return <FileText className="h-4 w-4 shrink-0 text-neutral-400" />;
    default:
      return <FileText className="h-4 w-4 shrink-0 text-neutral-400" />;
  }
}

export function RepoInteractiveFileTree({
  owner,
  repo,
  defaultBranch,
  tree,
}: RepoInteractiveFileTreeProps) {
  const rootNodes = useMemo(() => {
    return buildFileTreeHierarchy(tree.entries);
  }, [tree.entries]);

  // Collect all folder paths
  const allFolderPaths = useMemo(() => {
    const paths = new Set<string>();
    function traverse(nodes: FileTreeNode[]) {
      for (const node of nodes) {
        if (node.type === 'tree') {
          paths.add(node.path);
          traverse(node.children);
        }
      }
    }
    traverse(rootNodes);
    return paths;
  }, [rootNodes]);

  // Default: Expand top-level folders
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const node of rootNodes) {
      if (node.type === 'tree') {
        initial.add(node.path);
      }
    }
    return initial;
  });

  const [searchQuery, setSearchQuery] = useState('');

  // Toggle folder expansion
  const toggleFolder = useCallback((folderPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedPaths(new Set(allFolderPaths));
  }, [allFolderPaths]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  // Filter matching nodes and find all ancestor paths that must be expanded
  const { matchingPaths, pathsToAutoExpand } = useMemo(() => {
    if (!searchQuery.trim()) {
      return { matchingPaths: null, pathsToAutoExpand: null };
    }

    const q = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();
    const ancestors = new Set<string>();

    function searchNodes(nodes: FileTreeNode[]) {
      let hasMatch = false;
      for (const node of nodes) {
        const nameMatch =
          node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q);
        const childMatch = node.children.length > 0 && searchNodes(node.children);

        if (nameMatch || childMatch) {
          matches.add(node.path);
          hasMatch = true;

          // Add parent folders to ancestors
          const parts = node.path.split('/');
          let cur = '';
          for (let i = 0; i < parts.length - 1; i++) {
            cur = cur ? `${cur}/${parts[i]}` : parts[i];
            ancestors.add(cur);
          }
        }
      }
      return hasMatch;
    }

    searchNodes(rootNodes);
    return { matchingPaths: matches, pathsToAutoExpand: ancestors };
  }, [rootNodes, searchQuery]);

  // Effective expanded paths considers auto-expanded ancestors during search
  const isExpanded = useCallback(
    (folderPath: string) => {
      if (pathsToAutoExpand && pathsToAutoExpand.has(folderPath)) {
        return true;
      }
      return expandedPaths.has(folderPath);
    },
    [expandedPaths, pathsToAutoExpand]
  );

  // Recursive tree node renderer
  const renderTreeNode = (node: FileTreeNode, depth = 0) => {
    // If search active, skip non-matching nodes
    if (matchingPaths && !matchingPaths.has(node.path)) {
      return null;
    }

    const isDir = node.type === 'tree';
    const isOpen = isDir && isExpanded(node.path);
    const paddingLeft = `${depth * 18 + 12}px`;

    if (isDir) {
      return (
        <div key={node.path} className="flex flex-col">
          <button
            type="button"
            onClick={() => toggleFolder(node.path)}
            className="group flex w-full items-center justify-between py-1.5 pr-3 text-left font-mono text-xs transition-colors hover:bg-neutral-900/60"
            style={{ paddingLeft }}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} folder ${node.name}`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <ChevronRight
                className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-150 ${
                  isOpen ? 'rotate-90 text-neutral-300' : 'group-hover:text-neutral-300'
                }`}
              />
              {isOpen ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-blue-400" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-blue-400/90" />
              )}
              <span className="truncate font-medium text-blue-300 transition-colors group-hover:text-blue-200">
                {node.name}
              </span>
            </div>

            <span className="shrink-0 font-mono text-[11px] text-neutral-500 group-hover:text-neutral-400">
              {node.fileCount} {node.fileCount === 1 ? 'file' : 'files'}
            </span>
          </button>

          {isOpen && node.children.length > 0 && (
            <div className="ml-5 flex flex-col border-l border-neutral-900/80">
              {node.children.map((child) => renderTreeNode(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Blob / File Node
    const fileUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/blob/${encodeURIComponent(defaultBranch)}/${node.path.split('/').map(encodeURIComponent).join('/')}`;

    return (
      <div
        key={node.path}
        className="group flex items-center justify-between py-1.5 pr-3 font-mono text-xs transition-colors hover:bg-neutral-900/50"
        style={{ paddingLeft }}
      >
        <div className="flex min-w-0 items-center gap-2 pr-4">
          <span className="w-3.5" /> {/* Align with chevron */}
          {getFileIcon(node.name, node.type)}
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate text-neutral-300 transition-colors hover:text-white hover:underline"
            title={`View ${node.path} on GitHub`}
          >
            {node.name}
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-3 font-mono text-[11px] text-neutral-500">
          {typeof node.size === 'number' && <span>{formatBytes(node.size)}</span>}
          {node.sha && (
            <span className="hidden text-neutral-600 sm:inline" title={`SHA: ${node.sha}`}>
              {node.sha.slice(0, 7)}
            </span>
          )}
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-neutral-300"
            title="Open file in GitHub"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4 flex flex-col overflow-hidden rounded-lg border border-neutral-800/80 bg-neutral-950/70 select-none">
      {/* File Tree Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-900 bg-[#0d1117] px-3.5 py-2">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files in tree..."
            className="h-7 w-44 rounded-md border border-neutral-800 bg-neutral-900/90 pr-7 pl-8 font-mono text-xs text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-700 focus:outline-none sm:w-56"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-neutral-500 hover:text-neutral-300"
              aria-label="Clear file search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200"
            title="Expand all directories"
          >
            <ChevronsDown className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Expand All</span>
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className="flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1 text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-200"
            title="Collapse all directories"
          >
            <ChevronsUp className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Collapse All</span>
          </button>
        </div>
      </div>

      {/* Tree Content Area */}
      <div className="max-h-[550px] divide-y divide-neutral-900/60 overflow-y-auto">
        {rootNodes.length === 0 ? (
          <div className="py-12 text-center font-mono text-xs text-neutral-500">
            No files found in this repository branch.
          </div>
        ) : matchingPaths && matchingPaths.size === 0 ? (
          <div className="py-12 text-center font-mono text-xs text-neutral-500">
            No files matching &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <div className="py-1.5">{rootNodes.map((node) => renderTreeNode(node, 0))}</div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="flex items-center justify-between border-t border-neutral-900 bg-[#0a0d12] px-4 py-2 font-mono text-[11px] text-neutral-500">
        <span>Click any folder to expand or collapse</span>
        <span>
          {tree.totalFiles} files • {tree.totalDirectories} directories
        </span>
      </div>
    </div>
  );
}
