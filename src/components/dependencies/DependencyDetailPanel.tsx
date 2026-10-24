import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  FileCode,
  Package,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Copy,
  Check,
} from 'lucide-react';
import type { DependencyNode, DependencyEdge, CircularDependencyCycle } from '@/types/dependency';

interface DependencyDetailPanelProps {
  node: DependencyNode | null;
  edges: DependencyEdge[];
  cycles: CircularDependencyCycle[];
  owner: string;
  repo: string;
  defaultBranch: string;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
}

export function DependencyDetailPanel({
  node,
  edges,
  cycles,
  owner,
  repo,
  defaultBranch,
  onClose,
  onSelectNode,
}: DependencyDetailPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!node) return null;

  const isFile = node.type === 'file';
  const nodeName = isFile ? node.name : node.name;
  const nodePath = isFile ? node.path : node.name;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(nodePath);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find incoming and outgoing edges for this node
  const outgoingEdges = edges.filter((e) => (isFile ? e.sourceFile === node.path : false));
  const incomingEdges = edges.filter((e) =>
    isFile ? e.target === node.path : e.target === node.name
  );

  // Find cycles this node participates in
  const participatingCycles =
    isFile && node.inCycle ? cycles.filter((c) => c.files.includes(node.path)) : [];

  const getGitHubUrl = () => {
    if (!isFile) return null;
    return `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${node.path}`;
  };

  const getPackageRegistryUrl = () => {
    if (isFile) return null;
    if (node.ecosystem === 'npm') return `https://www.npmjs.com/package/${node.name}`;
    if (node.ecosystem === 'pypi') return `https://pypi.org/project/${node.name}`;
    if (node.ecosystem === 'cargo') return `https://crates.io/crates/${node.name}`;
    return null;
  };

  return (
    <div className="animate-in fade-in slide-in-from-right-4 absolute top-16 right-4 z-20 max-h-[calc(100vh-80px)] w-84 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950/95 p-4 font-mono text-xs text-neutral-300 shadow-2xl backdrop-blur-md duration-150 sm:w-96">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
        <div className="flex items-center gap-2 truncate">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
              isFile
                ? node.inCycle
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                  : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
                : 'border-purple-500/30 bg-purple-500/10 text-purple-400'
            }`}
          >
            {isFile ? <FileCode className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
          </div>
          <span className="truncate font-semibold text-white" title={nodeName}>
            {nodeName}
          </span>
        </div>

        <button
          onClick={onClose}
          className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Path & Actions */}
      <div className="mt-3 flex items-center justify-between rounded-lg border border-neutral-800/80 bg-neutral-900/60 px-2.5 py-1.5 text-[11px]">
        <span className="truncate pr-2 text-neutral-400" title={nodePath}>
          {nodePath}
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={handleCopyPath}
            title="Copy path"
            className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          </button>

          {isFile ? (
            <a
              href={getGitHubUrl()!}
              target="_blank"
              rel="noopener noreferrer"
              title="Open file on GitHub"
              className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            getPackageRegistryUrl() && (
              <a
                href={getPackageRegistryUrl()!}
                target="_blank"
                rel="noopener noreferrer"
                title="View on Registry"
                className="flex h-6 w-6 items-center justify-center rounded text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )
          )}
        </div>
      </div>

      {/* Circular Dependency Alert */}
      {participatingCycles.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-rose-300">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Circular Dependency Detected</span>
          </div>
          <div className="mt-2 space-y-2">
            {participatingCycles.map((cycle) => (
              <div key={cycle.id} className="space-y-1 rounded bg-black/40 p-2 text-[10px]">
                <span className="font-bold text-rose-400">{cycle.id}:</span>
                <div className="flex flex-wrap items-center gap-1 text-neutral-300">
                  {cycle.files.map((f, idx) => (
                    <React.Fragment key={idx}>
                      <span
                        className={`cursor-pointer hover:underline ${
                          f === (node as { path: string }).path
                            ? 'font-semibold text-rose-300'
                            : 'text-neutral-400'
                        }`}
                        onClick={() => onSelectNode?.(`file:${f}`)}
                        title={f}
                      >
                        {f.split('/').pop()}
                      </span>
                      {idx < cycle.files.length - 1 && (
                        <span className="text-neutral-600">&rarr;</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Properties Table */}
      <div className="mt-4 space-y-2 border-t border-neutral-800/80 pt-3 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-neutral-400">Node Type</span>
          <span className="font-medium text-white capitalize">{node.type}</span>
        </div>

        {isFile ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Language</span>
              <span className="font-medium text-cyan-400 uppercase">{node.language}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Incoming Imports</span>
              <span className="font-medium text-emerald-400">{incomingEdges.length} files</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Outgoing Imports</span>
              <span className="font-medium text-cyan-400">{outgoingEdges.length} modules</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Ecosystem</span>
              <span className="font-medium text-purple-400 uppercase">{node.ecosystem}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Version Constraint</span>
              <span className="text-neutral-200">{node.versionConstraint || 'None'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">Dependency Kind</span>
              <span className="text-neutral-200">
                {node.isDev ? 'Development' : 'Direct Production'}
              </span>
            </div>
            {node.manifestSource && (
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Manifest</span>
                <span className="text-neutral-300">{node.manifestSource}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Outgoing Imports Section (for files) */}
      {isFile && outgoingEdges.length > 0 && (
        <div className="mt-4 border-t border-neutral-800/80 pt-3">
          <div className="flex items-center justify-between pb-2 text-[11px] font-semibold text-neutral-300">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5 text-cyan-400" />
              <span>Imports ({outgoingEdges.length})</span>
            </span>
          </div>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {outgoingEdges.map((edge) => (
              <div
                key={edge.id}
                onClick={() =>
                  onSelectNode?.(
                    edge.kind === 'internal' ? `file:${edge.target}` : `pkg:${edge.target}`
                  )
                }
                className="flex cursor-pointer items-center justify-between rounded border border-neutral-800/80 bg-neutral-900/40 px-2 py-1 text-[10px] transition-colors hover:border-neutral-700 hover:bg-neutral-800/60"
              >
                <div className="truncate pr-2">
                  <span className="truncate font-mono text-neutral-200">{edge.target}</span>
                  <span className="block text-[9px] text-neutral-500">
                    specifier: {edge.rawSpecifier}
                  </span>
                </div>
                <span
                  className={`shrink-0 rounded px-1 py-0.5 text-[8px] uppercase ${
                    edge.kind === 'internal'
                      ? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-400'
                      : edge.kind === 'external'
                        ? 'border border-purple-500/20 bg-purple-500/10 text-purple-400'
                        : 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
                  }`}
                >
                  {edge.kind}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Incoming Imports Section */}
      {incomingEdges.length > 0 && (
        <div className="mt-4 border-t border-neutral-800/80 pt-3">
          <div className="flex items-center justify-between pb-2 text-[11px] font-semibold text-neutral-300">
            <span className="flex items-center gap-1">
              <ArrowDownRight className="h-3.5 w-3.5 text-emerald-400" />
              <span>Imported By ({incomingEdges.length})</span>
            </span>
          </div>
          <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
            {incomingEdges.map((edge) => (
              <div
                key={edge.id}
                onClick={() => onSelectNode?.(`file:${edge.sourceFile}`)}
                className="flex cursor-pointer items-center justify-between rounded border border-neutral-800/80 bg-neutral-900/40 px-2 py-1 text-[10px] transition-colors hover:border-neutral-700 hover:bg-neutral-800/60"
              >
                <span className="truncate pr-2 font-mono text-neutral-300">{edge.sourceFile}</span>
                <span className="shrink-0 text-[9px] text-neutral-500">L{edge.line}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
