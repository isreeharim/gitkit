import { Handle, Position } from '@xyflow/react';
import {
  FileCode,
  Package,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';
import type { FileDependencyNode, PackageDependencyNode } from '@/types/dependency';
import type { DependencyNodePayload } from '@/lib/analyzer/react-flow-adapter';

/**
 * Custom React Flow node representing an internal source file.
 */
export function DependencyFileNodeComponent({ data }: { data: DependencyNodePayload }) {
  const node = data.node as FileDependencyNode;

  return (
    <div
      onClick={() => data.onSelectNode?.(node.id)}
      className={`group relative flex w-[260px] cursor-pointer flex-col rounded-xl border p-3 shadow-xl backdrop-blur-md transition-all ${
        node.inCycle
          ? 'border-rose-500/80 bg-rose-950/20 ring-1 ring-rose-500/30'
          : data.isSelected
            ? 'border-emerald-500 bg-neutral-900 ring-2 ring-emerald-500/30'
            : data.isMatching
              ? 'border-emerald-400 bg-neutral-900 ring-1 ring-emerald-400/40'
              : 'border-neutral-800 bg-neutral-900/90 hover:border-neutral-700'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-neutral-900 !bg-neutral-400"
      />

      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
        <div className="flex items-center gap-2 truncate">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
              node.inCycle
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400'
            }`}
          >
            {node.inCycle ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <FileCode className="h-3.5 w-3.5" />
            )}
          </div>
          <span className="truncate font-mono text-xs font-semibold text-white" title={node.name}>
            {node.name}
          </span>
        </div>

        <span
          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase ${
            node.language === 'typescript' || node.language === 'tsx'
              ? 'border border-blue-500/20 bg-blue-500/10 text-blue-400'
              : node.language === 'python'
                ? 'border border-amber-500/20 bg-amber-500/10 text-amber-400'
                : 'bg-neutral-800 text-neutral-300'
          }`}
        >
          {node.language}
        </span>
      </div>

      <div className="mt-2 truncate font-mono text-[11px] text-neutral-400" title={node.path}>
        {node.path}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-neutral-800/50 pt-2 font-mono text-[11px] text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-0.5 text-neutral-400" title="Incoming imports">
            <ArrowDownRight className="h-3 w-3 text-emerald-400" />
            <span>{node.inDegree}</span>
          </span>
          <span className="flex items-center gap-0.5 text-neutral-400" title="Outgoing imports">
            <ArrowUpRight className="h-3 w-3 text-cyan-400" />
            <span>{node.outDegree}</span>
          </span>
        </div>

        {node.inCycle && (
          <span className="animate-pulse rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
            Cycle
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-neutral-900 !bg-neutral-400"
      />
    </div>
  );
}

/**
 * Custom React Flow node representing an external package dependency.
 */
export function DependencyPackageNodeComponent({ data }: { data: DependencyNodePayload }) {
  const node = data.node as PackageDependencyNode;

  return (
    <div
      onClick={() => data.onSelectNode?.(node.id)}
      className={`group relative flex w-[220px] cursor-pointer flex-col rounded-xl border p-2.5 shadow-xl backdrop-blur-md transition-all ${
        data.isSelected
          ? 'border-purple-500 bg-neutral-900 ring-2 ring-purple-500/30'
          : data.isMatching
            ? 'border-purple-400 bg-neutral-900 ring-1 ring-purple-400/40'
            : 'border-neutral-800 bg-neutral-900/90 hover:border-neutral-700'
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-neutral-900 !bg-purple-400"
      />

      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 truncate">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-400">
            <Package className="h-3 w-3" />
          </div>
          <span className="truncate font-mono text-xs font-semibold text-white" title={node.name}>
            {node.name}
          </span>
        </div>

        <span className="rounded border border-purple-500/20 bg-purple-500/10 px-1 py-0.5 font-mono text-[9px] text-purple-300 uppercase">
          {node.ecosystem}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-neutral-400">
        <span className="max-w-[120px] truncate text-neutral-300">
          {node.versionConstraint || 'installed'}
        </span>
        {node.isDev ? (
          <span className="rounded bg-neutral-800 px-1 py-0.5 text-[9px] text-neutral-400">
            dev
          </span>
        ) : (
          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400">
            <CheckCircle2 className="h-2.5 w-2.5" />
            <span>direct</span>
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!h-2.5 !w-2.5 !rounded-full !border-2 !border-neutral-900 !bg-purple-400"
      />
    </div>
  );
}
