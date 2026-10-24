import React from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Star,
} from 'lucide-react';
import { formatBytes, formatCompactNumber } from '@/lib/utils';
import type {
  RepositoryGraphNode,
  DirectoryGraphNode,
  FileGraphNode,
} from '@/lib/graph/graph-model';
import type { NodeDataPayload } from '@/lib/graph/react-flow-adapter';

/**
 * Custom node representing the repository root.
 */
export function RepositoryNodeComponent({ data }: { data: NodeDataPayload }) {
  const node = data.node as RepositoryGraphNode;

  return (
    <div
      onClick={() => data.onSelectNode?.(node.id)}
      className={`group relative flex w-[260px] cursor-pointer flex-col rounded-xl border bg-neutral-900/90 p-3.5 shadow-xl transition-all ${
        data.isSelected
          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
          : data.isMatching
            ? 'border-emerald-400 ring-1 ring-emerald-400/40'
            : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <GitBranch className="h-3.5 w-3.5" />
          </div>
          <span className="max-w-[150px] truncate font-mono text-xs font-semibold text-white">
            {node.name}
          </span>
        </div>
        <span className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400">
          root
        </span>
      </div>

      <div className="mt-2.5 flex items-center justify-between font-mono text-[11px] text-neutral-400">
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-amber-400" />
          <span>{formatCompactNumber(node.stars)}</span>
        </div>
        {node.language && <span className="text-emerald-400">{node.language}</span>}
        <span>{node.totalFiles} files</span>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !border-2 !border-neutral-900 !bg-emerald-500"
      />
    </div>
  );
}

/**
 * Custom node representing a directory.
 */
export function DirectoryNodeComponent({ data }: { data: NodeDataPayload }) {
  const node = data.node as DirectoryGraphNode;
  const isCollapsed = data.isCollapsed;
  const hasChildren = node.childIds.length > 0;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onToggleCollapse?.(node.id);
  };

  return (
    <div
      onClick={() => data.onSelectNode?.(node.id)}
      className={`group relative flex w-[260px] cursor-pointer flex-col rounded-xl border bg-neutral-900/90 p-3 shadow-lg transition-all ${
        data.isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : data.isMatching
            ? 'border-emerald-400 bg-emerald-950/20 ring-1 ring-emerald-400/40'
            : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-neutral-900 !bg-blue-500"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isCollapsed ? (
            <Folder className="h-4 w-4 shrink-0 text-blue-400" />
          ) : (
            <FolderOpen className="h-4 w-4 shrink-0 text-blue-300" />
          )}
          <span
            className="truncate font-mono text-xs font-medium text-neutral-200"
            title={node.path}
          >
            {node.name}
          </span>
        </div>

        {hasChildren && (
          <button
            type="button"
            onClick={handleToggle}
            title={isCollapsed ? 'Expand directory' : 'Collapse directory'}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-neutral-800 text-neutral-400 transition-colors hover:bg-neutral-700 hover:text-white"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-neutral-800/60 pt-1.5 font-mono text-[10px] text-neutral-500">
        <span>
          {node.childFileCount} files
          {node.childDirectoryCount > 0 ? `, ${node.childDirectoryCount} dirs` : ''}
        </span>
        {isCollapsed && <span className="text-blue-400/80">{node.totalDescendantFiles} total</span>}
      </div>

      {!isCollapsed && hasChildren && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-2.5 !w-2.5 !border-2 !border-neutral-900 !bg-blue-500"
        />
      )}
    </div>
  );
}

/**
 * Custom node representing an individual file.
 */
export function FileNodeComponent({ data }: { data: NodeDataPayload }) {
  const node = data.node as FileGraphNode;

  const isCode = [
    'ts',
    'tsx',
    'js',
    'jsx',
    'rs',
    'go',
    'py',
    'json',
    'yaml',
    'yml',
    'css',
    'html',
  ].includes(node.extension);

  return (
    <div
      onClick={() => data.onSelectNode?.(node.id)}
      className={`group relative flex w-[260px] cursor-pointer items-center justify-between rounded-xl border bg-neutral-900/90 px-3 py-2.5 shadow-sm transition-all ${
        data.isSelected
          ? 'border-emerald-500 ring-2 ring-emerald-500/30'
          : data.isMatching
            ? 'border-emerald-400 bg-emerald-950/20 ring-1 ring-emerald-400/40'
            : 'border-neutral-800 hover:border-neutral-700'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !border-2 !border-neutral-900 !bg-emerald-500"
      />

      <div className="flex min-w-0 items-center gap-2 pr-2">
        {isCode ? (
          <FileCode className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
        ) : (
          <FileText className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        )}
        <span className="truncate font-mono text-xs text-neutral-300" title={node.path}>
          {node.name}
        </span>
      </div>

      <span className="shrink-0 font-mono text-[10px] text-neutral-500">
        {formatBytes(node.size)}
      </span>
    </div>
  );
}
