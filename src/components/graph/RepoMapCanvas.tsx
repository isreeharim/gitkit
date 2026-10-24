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
import { Search, X, Maximize2, FolderMinus, FolderPlus, Filter, Layers, Info } from 'lucide-react';
import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import { buildRepositoryGraph } from '@/lib/graph/tree-to-graph';
import {
  getInitialCollapsedDirectoryIds,
  toggleDirectoryCollapse,
  expandAllDirectories,
  collapseAllDirectories,
  getVisibleGraph,
} from '@/lib/graph/graph-collapse';
import { filterGraph, getAvailableExtensions } from '@/lib/graph/graph-filter';
import { computeHierarchicalLayout } from '@/lib/graph/graph-layout';
import { serializeToReactFlow } from '@/lib/graph/react-flow-adapter';
import { RepositoryNodeComponent, DirectoryNodeComponent, FileNodeComponent } from './CustomNodes';
import { NodeDetailPanel } from './NodeDetailPanel';
import { ExportControl } from '../export/ExportControl';

const nodeTypes = {
  repoNode: RepositoryNodeComponent,
  dirNode: DirectoryNodeComponent,
  fileNode: FileNodeComponent,
};

interface RepoMapCanvasProps {
  metadata: RepositoryMetadata;
  tree: RepositoryTree;
}

function InnerRepoMap({ metadata, tree }: RepoMapCanvasProps) {
  const { fitView } = useReactFlow();

  // 1. Build deterministic base graph
  const graph = useMemo(() => {
    return buildRepositoryGraph(metadata, tree);
  }, [metadata, tree]);

  // Available extensions for filtering
  const availableExtensions = useMemo(() => {
    return getAvailableExtensions(graph);
  }, [graph]);

  // 2. State management
  const [collapsedDirIds, setCollapsedDirIds] = useState<Set<string>>(() =>
    getInitialCollapsedDirectoryIds(graph, 1)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'directory' | 'file'>('all');
  const [extensionFilter, setExtensionFilter] = useState('all');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // 3. Filtering
  const filterResult = useMemo(() => {
    return filterGraph(graph, {
      query: searchQuery,
      typeFilter,
      extension: extensionFilter === 'all' ? undefined : extensionFilter,
    });
  }, [graph, searchQuery, typeFilter, extensionFilter]);

  const isFilterActive =
    searchQuery.trim().length > 0 || typeFilter !== 'all' || extensionFilter !== 'all';

  // 4. Effective collapsed state (reveals ancestor directories of matching nodes)
  const effectiveCollapsed = useMemo(() => {
    if (filterResult.ancestorIdsToExpand.size === 0) {
      return collapsedDirIds;
    }
    const copy = new Set(collapsedDirIds);
    for (const id of filterResult.ancestorIdsToExpand) {
      copy.delete(id);
    }
    return copy;
  }, [collapsedDirIds, filterResult.ancestorIdsToExpand]);

  // 5. Derive visible graph
  const { visibleNodes, visibleEdges, visibleNodeIds } = useMemo(() => {
    return getVisibleGraph(graph, effectiveCollapsed);
  }, [graph, effectiveCollapsed]);

  // 6. Compute layout coordinates
  const positions = useMemo(() => {
    return computeHierarchicalLayout(graph, visibleNodeIds);
  }, [graph, visibleNodeIds]);

  // Handlers
  const handleToggleCollapse = useCallback((dirId: string) => {
    setCollapsedDirIds((prev) => toggleDirectoryCollapse(prev, dirId));
  }, []);

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  const handleExpandAll = useCallback(() => {
    setCollapsedDirIds(expandAllDirectories());
  }, []);

  const handleCollapseAll = useCallback(() => {
    setCollapsedDirIds(collapseAllDirectories(graph));
  }, [graph]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 400 });
  }, [fitView]);

  // 7. Serialize to React Flow
  const { nodes, edges } = useMemo(() => {
    return serializeToReactFlow(visibleNodes, visibleEdges, positions, {
      collapsedDirIds: effectiveCollapsed,
      matchingNodeIds: filterResult.matchingNodeIds,
      selectedNodeId,
      onToggleCollapse: handleToggleCollapse,
      onSelectNode: handleSelectNode,
    });
  }, [
    visibleNodes,
    visibleEdges,
    positions,
    effectiveCollapsed,
    filterResult.matchingNodeIds,
    selectedNodeId,
    handleToggleCollapse,
    handleSelectNode,
  ]);

  // Currently selected node object
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
      <header className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950/85 p-2 shadow-xl backdrop-blur-md">
        {/* Search Input */}
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files or folders..."
            className="h-8 w-48 rounded-lg border border-neutral-800 bg-neutral-900/80 pr-7 pl-8 font-mono text-xs text-neutral-200 placeholder-neutral-500 transition-colors focus:border-emerald-500/60 focus:bg-neutral-900 focus:outline-none sm:w-64"
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

        {/* Extension Filter */}
        {availableExtensions.length > 0 && (
          <div className="flex items-center gap-1.5 border-l border-neutral-800/80 pl-2">
            <Filter className="h-3.5 w-3.5 text-neutral-400" />
            <select
              value={extensionFilter}
              onChange={(e) => setExtensionFilter(e.target.value)}
              className="h-8 cursor-pointer rounded-lg border border-neutral-800 bg-neutral-900/80 px-2 font-mono text-xs text-neutral-300 focus:border-emerald-500/60 focus:outline-none"
            >
              <option value="all">All Exts</option>
              {availableExtensions.map((ext) => (
                <option key={ext} value={ext}>
                  .{ext}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Type Filter */}
        <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5 font-mono text-xs">
          <button
            onClick={() => setTypeFilter('all')}
            className={`rounded px-2 py-1 transition-colors ${
              typeFilter === 'all'
                ? 'bg-neutral-800 font-medium text-white'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setTypeFilter('directory')}
            className={`rounded px-2 py-1 transition-colors ${
              typeFilter === 'directory'
                ? 'bg-neutral-800 font-medium text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Dirs
          </button>
          <button
            onClick={() => setTypeFilter('file')}
            className={`rounded px-2 py-1 transition-colors ${
              typeFilter === 'file'
                ? 'bg-neutral-800 font-medium text-cyan-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Files
          </button>
        </div>

        {/* Expand / Collapse / Fit */}
        <div className="flex items-center gap-1 border-l border-neutral-800/80 pl-2">
          <button
            onClick={handleExpandAll}
            title="Expand All Directories"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 font-mono text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
          >
            <FolderPlus className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Expand All</span>
          </button>
          <button
            onClick={handleCollapseAll}
            title="Collapse All Directories"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 font-mono text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
          >
            <FolderMinus className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden sm:inline">Collapse</span>
          </button>
          <button
            onClick={handleFitView}
            title="Fit View"
            className="flex h-8 items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/80 px-2.5 font-mono text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
          >
            <Maximize2 className="h-3.5 w-3.5 text-neutral-300" />
            <span className="hidden sm:inline">Fit</span>
          </button>
        </div>

        {/* Export Action */}
        <div className="flex items-center gap-1 border-l border-neutral-800/80 pl-2">
          <ExportControl
            owner={metadata.owner}
            repo={metadata.name}
            defaultTarget="repomap"
            repoGraph={graph}
            visibleNodeIds={new Set(visibleNodes.map((n) => n.id))}
            metadata={metadata}
          />
        </div>

        {/* Stats counter badge */}
        <div className="hidden items-center gap-1.5 border-l border-neutral-800/80 pl-2 font-mono text-[11px] text-neutral-400 lg:flex">
          <Layers className="h-3 w-3 text-neutral-400" />
          <span>
            {visibleNodes.length} / {graph.nodes.size} nodes
          </span>
          {isFilterActive && (
            <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400">
              {filterResult.totalMatches} matches
            </span>
          )}
        </div>
      </header>

      {/* Truncated notice */}
      {tree.truncated && (
        <aside
          role="note"
          aria-label="Repository truncated notice"
          className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-xs text-amber-300 backdrop-blur-md"
        >
          <Info className="h-3.5 w-3.5 text-amber-400" />
          <span>Large repo: GitHub truncated file tree at 100,000 items.</span>
        </aside>
      )}

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

      {/* Node Detail Inspector Panel */}
      <NodeDetailPanel
        node={selectedNode}
        owner={metadata.owner}
        repo={metadata.name}
        defaultBranch={metadata.defaultBranch}
        isCollapsed={selectedNode ? effectiveCollapsed.has(selectedNode.id) : false}
        onClose={() => setSelectedNodeId(null)}
        onToggleCollapse={handleToggleCollapse}
      />
    </div>
  );
}

export function RepoMapCanvas(props: RepoMapCanvasProps) {
  return (
    <ReactFlowProvider>
      <InnerRepoMap {...props} />
    </ReactFlowProvider>
  );
}
