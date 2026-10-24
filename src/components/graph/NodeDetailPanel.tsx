import React from 'react';
import { X, ExternalLink, Folder, FileCode, GitBranch, Copy, Check } from 'lucide-react';
import type {
  RepoGraphNode,
  RepositoryGraphNode,
  DirectoryGraphNode,
  FileGraphNode,
} from '@/lib/graph/graph-model';
import { formatBytes } from '@/lib/utils';

interface NodeDetailPanelProps {
  node: RepoGraphNode | null;
  owner: string;
  repo: string;
  defaultBranch: string;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse?: (dirId: string) => void;
}

export function NodeDetailPanel({
  node,
  owner,
  repo,
  defaultBranch,
  isCollapsed,
  onClose,
  onToggleCollapse,
}: NodeDetailPanelProps) {
  const [copied, setCopied] = React.useState(false);

  if (!node) return null;

  const handleCopyPath = () => {
    if (!node.path) return;
    navigator.clipboard.writeText(node.path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getGitHubUrl = () => {
    if (node.type === 'repository') {
      return `https://github.com/${owner}/${repo}`;
    }
    const mode = node.type === 'directory' ? 'tree' : 'blob';
    return `https://github.com/${owner}/${repo}/${mode}/${defaultBranch}/${node.path}`;
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 absolute top-16 right-4 z-20 w-80 rounded-xl border border-neutral-800 bg-neutral-950/95 p-4 font-mono text-xs text-neutral-300 shadow-2xl backdrop-blur-md duration-150">
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {node.type === 'repository' ? (
            <GitBranch className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : node.type === 'directory' ? (
            <Folder className="h-4 w-4 shrink-0 text-blue-400" />
          ) : (
            <FileCode className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span className="truncate font-semibold text-white">{node.name}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close detail panel"
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {/* Node Type Badge */}
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-neutral-500">TYPE</span>
          <span className="text-neutral-200 capitalize">{node.type}</span>
        </div>

        {/* Path with Copy */}
        {node.path && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-500">
              <span>PATH</span>
              <button
                type="button"
                onClick={handleCopyPath}
                className="flex items-center gap-1 text-[10px] text-neutral-400 transition-colors hover:text-white"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="rounded border border-neutral-800/60 bg-neutral-900 p-2 text-[11px] break-all text-neutral-300 select-all">
              {node.path}
            </div>
          </div>
        )}

        {/* Specific Type Details */}
        {node.type === 'file' && (
          <>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">SIZE</span>
              <span className="text-neutral-200">
                {formatBytes((node as FileGraphNode).size)} (
                {(node as FileGraphNode).size.toLocaleString()} B)
              </span>
            </div>
            {(node as FileGraphNode).extension && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500">EXTENSION</span>
                <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-neutral-300">
                  .{(node as FileGraphNode).extension}
                </span>
              </div>
            )}
            {(node as FileGraphNode).sha && (
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500">SHA</span>
                <span className="text-neutral-400">
                  {(node as FileGraphNode).sha.slice(0, 10)}...
                </span>
              </div>
            )}
          </>
        )}

        {node.type === 'directory' && (
          <>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">DIRECT CONTENTS</span>
              <span className="text-neutral-200">
                {(node as DirectoryGraphNode).childFileCount} files,{' '}
                {(node as DirectoryGraphNode).childDirectoryCount} dirs
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">TOTAL DESCENDANTS</span>
              <span className="text-neutral-200">
                {(node as DirectoryGraphNode).totalDescendantFiles} files
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">TOTAL SIZE</span>
              <span className="text-neutral-200">
                {formatBytes((node as DirectoryGraphNode).totalDescendantBytes)}
              </span>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => onToggleCollapse?.(node.id)}
                className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-1.5 text-xs text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                {isCollapsed ? 'Expand Children' : 'Collapse Children'}
              </button>
            </div>
          </>
        )}

        {node.type === 'repository' && (
          <>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">TOTAL FILES</span>
              <span className="text-neutral-200">{(node as RepositoryGraphNode).totalFiles}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-500">TOTAL TREE SIZE</span>
              <span className="text-neutral-200">
                {formatBytes((node as RepositoryGraphNode).totalBytes)}
              </span>
            </div>
          </>
        )}

        {/* GitHub External Action */}
        <div className="border-t border-neutral-800/80 pt-2">
          <a
            href={getGitHubUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-900 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <span>View on GitHub</span>
            <ExternalLink className="h-3 w-3 text-neutral-400" />
          </a>
        </div>
      </div>
    </div>
  );
}
