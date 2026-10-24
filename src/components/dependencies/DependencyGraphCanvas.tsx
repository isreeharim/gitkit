import { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Search,
  X,
  Maximize2,
  AlertTriangle,
  FileCode,
  Package,
  Layers,
  HelpCircle,
} from 'lucide-react';
import type { DependencyGraph } from '@/types/dependency';
import { filterDependencyGraph, type DependencyFilterMode } from '@/lib/analyzer/graph-filter';
import { computeDependencyLayout } from '@/lib/analyzer/graph-layout';
import { serializeDependenciesToReactFlow } from '@/lib/analyzer/react-flow-adapter';
import {
  DependencyFileNodeComponent,
  DependencyPackageNodeComponent,
} from './DependencyCustomNodes';
import { DependencyDetailPanel } from './DependencyDetailPanel';

const nodeTypes = {
  depFileNode: DependencyFileNodeComponent,
  depPackageNode: DependencyPackageNodeComponent,
};

interface DependencyGraphCanvasProps {
  graph: DependencyGraph;
  owner: string;
  repo: string;
  defaultBranch: string;
}

function InnerDependencyCanvas({ graph, owner, repo, defaultBranch }: DependencyGraphCanvasProps) {
  const { fitView } = useReactFlow();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<DependencyFilterMode>('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 1. Filter graph
  const filtered = useMemo(() => {
    return filterDependencyGraph(graph, {
      searchQuery,
      filterMode,
    });
  }, [graph, searchQuery, filterMode]);

  // 2. Compute 2D coordinates
  const positions = useMemo(() => {
    return computeDependencyLayout(filtered.visibleNodes, filtered.visibleEdges);
  }, [filtered.visibleNodes, filtered.visibleEdges]);

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 400 });
  }, [fitView]);

  // 3. Serialize to React Flow
  const { nodes, edges } = useMemo(() => {
    return serializeDependenciesToReactFlow(
      filtered.visibleNodes,
      filtered.visibleEdges,
      positions,
      {
        selectedNodeId,
        matchingNodeIds: filtered.matchingNodeIds,
        cycles: graph.cycles,
        onSelectNode: handleSelectNode,
      }
    );
  }, [
    filtered.visibleNodes,
    filtered.visibleEdges,
    positions,
    selectedNodeId,
    filtered.matchingNodeIds,
    graph.cycles,
    handleSelectNode,
  ]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graph.nodes.get(selectedNodeId) || null;
  }, [selectedNodeId, graph]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNodeId(node.id);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#070b12] text-neutral-100 select-none">
      {/* Top Toolbar */}
      <header className="absolute top-4 left-4 z-10 flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/85 p-2 shadow-xl backdrop-blur-md">
        {/* Search */}
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search module or package..."
            className="h-8 w-44 rounded-lg border border-neutral-800 bg-neutral-900/80 pr-7 pl-8 font-mono text-xs text-neutral-200 placeholder-neutral-500 transition-colors focus:border-cyan-500/60 focus:bg-neutral-900 focus:outline-none sm:w-56"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 text-neutral-400 hover:text-white"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter Mode Buttons */}
        <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5 font-mono text-xs">
          <button
            onClick={() => setFilterMode('all')}
            className={`rounded px-2 py-1 transition-colors ${
              filterMode === 'all'
                ? 'bg-neutral-800 font-medium text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterMode('internal')}
            className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
              filterMode === 'internal'
                ? 'bg-neutral-800 font-medium text-cyan-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="h-3 w-3" />
            <span className="hidden sm:inline">Internal</span>
          </button>
          <button
            onClick={() => setFilterMode('external')}
            className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
              filterMode === 'external'
                ? 'bg-neutral-800 font-medium text-purple-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Package className="h-3 w-3" />
            <span className="hidden sm:inline">Packages</span>
          </button>
          <button
            onClick={() => setFilterMode('unresolved')}
            className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
              filterMode === 'unresolved'
                ? 'bg-neutral-800 font-medium text-amber-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <HelpCircle className="h-3 w-3" />
            <span className="hidden sm:inline">Unresolved</span>
          </button>

          {/* Circular Dependencies filter pill */}
          <button
            onClick={() => setFilterMode(filterMode === 'cycles_only' ? 'all' : 'cycles_only')}
            className={`flex items-center gap-1 rounded px-2 py-1 transition-colors ${
              filterMode === 'cycles_only'
                ? 'border border-rose-500/40 bg-rose-500/20 font-semibold text-rose-300'
                : graph.cycles.length > 0
                  ? 'text-rose-400 hover:bg-rose-500/10'
                  : 'text-neutral-500'
            }`}
            title={
              graph.cycles.length > 0
                ? `${graph.cycles.length} circular dependency cycle(s) detected`
                : 'No circular dependencies detected'
            }
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>Cycles ({graph.cycles.length})</span>
          </button>
        </div>

        {/* Fit View Button */}
        <button
          onClick={handleFitView}
          title="Fit view to graph"
          className="flex h-8 items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 font-mono text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
        >
          <Maximize2 className="h-3.5 w-3.5 text-neutral-300" />
          <span className="hidden md:inline">Fit</span>
        </button>

        {/* Stats counter */}
        <div className="hidden items-center gap-2 border-l border-neutral-800/80 pl-2 font-mono text-[11px] text-neutral-400 xl:flex">
          <Layers className="h-3 w-3 text-neutral-500" />
          <span>
            {filtered.visibleNodes.length} nodes • {filtered.visibleEdges.length} edges
          </span>
          {graph.stats.uniquePackagesCount > 0 && (
            <span className="text-purple-400">{graph.stats.uniquePackagesCount} packages</span>
          )}
        </div>
      </header>

      {/* React Flow Viewport */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        fitView
        minZoom={0.08}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.2}
          color="rgba(255, 255, 255, 0.07)"
        />
        <Controls
          className="overflow-hidden !rounded-lg !border-neutral-800 !bg-neutral-950 !shadow-xl [&>button]:!border-neutral-800 [&>button]:!bg-neutral-900 [&>button]:!text-neutral-300 [&>button:hover]:!bg-neutral-800 [&>button>svg]:!fill-neutral-300"
          showInteractive={false}
        />
      </ReactFlow>

      {/* Inspector Detail Panel */}
      <DependencyDetailPanel
        node={selectedNode}
        edges={graph.edges}
        cycles={graph.cycles}
        owner={owner}
        repo={repo}
        defaultBranch={defaultBranch}
        onClose={() => setSelectedNodeId(null)}
        onSelectNode={handleSelectNode}
      />
    </div>
  );
}

export function DependencyGraphCanvas(props: DependencyGraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerDependencyCanvas {...props} />
    </ReactFlowProvider>
  );
}
