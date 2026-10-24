import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Check,
  Download,
  Code2,
  ExternalLink,
  Info,
  Search,
  X,
  Workflow,
} from 'lucide-react';
import type { DiagramGraph, DiagramNode } from '@/types/diagram';
import type { RepositoryMetadata } from '@/types/repository';
import { exportSvgToPngBlob } from '@/lib/export/png-exporter';
import { downloadBlob, downloadText } from '@/lib/export/browser-download';
import { sanitizeMermaidId } from '@/lib/diagram/mermaid-compiler';

interface DiagramCanvasProps {
  owner: string;
  repo: string;
  metadata: RepositoryMetadata;
  graph: DiagramGraph;
  mermaidCode: string;
}

export function DiagramCanvas({ owner, repo, metadata, graph, mermaidCode }: DiagramCanvasProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [showCode, setShowCode] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<DiagramNode | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pan & Zoom state
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const diagramWrapperRef = useRef<HTMLDivElement>(null);

  const isDraggingRef = useRef<boolean>(false);
  const dragDistanceRef = useRef<number>(0);
  const dragStartRef = useRef<{ startX: number; startY: number; panX: number; panY: number }>({
    startX: 0,
    startY: 0,
    panX: 0,
    panY: 0,
  });

  // 1. Auto-fit diagram to screen
  const autoFitDiagram = useCallback(() => {
    if (!containerRef.current || !diagramWrapperRef.current) return;
    const container = containerRef.current;
    const svgEl = diagramWrapperRef.current.querySelector('svg');
    if (!svgEl) return;

    // Remove any restrictive inline max-width from Mermaid
    svgEl.style.maxWidth = 'none';

    let svgWidth = 900;
    let svgHeight = 600;

    if (svgEl.viewBox?.baseVal?.width && svgEl.viewBox?.baseVal?.height) {
      svgWidth = svgEl.viewBox.baseVal.width;
      svgHeight = svgEl.viewBox.baseVal.height;
    } else {
      const bbox = svgEl.getBBox?.();
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        svgWidth = bbox.width;
        svgHeight = bbox.height;
      } else if (svgEl.clientWidth > 0 && svgEl.clientHeight > 0) {
        svgWidth = svgEl.clientWidth;
        svgHeight = svgEl.clientHeight;
      }
    }

    const containerWidth = container.clientWidth || window.innerWidth;
    const containerHeight = container.clientHeight || window.innerHeight - 150;

    const padding = 60;
    const availableWidth = Math.max(100, containerWidth - padding);
    const availableHeight = Math.max(100, containerHeight - padding);

    const scaleX = availableWidth / svgWidth;
    const scaleY = availableHeight / svgHeight;
    const optimalScale = Math.min(Math.max(0.25, Math.min(scaleX, scaleY)), 1.15);

    const centerX = (containerWidth - svgWidth * optimalScale) / 2;
    const centerY = (containerHeight - svgHeight * optimalScale) / 2;

    setScale(Number(optimalScale.toFixed(2)));
    setPan({ x: Math.round(centerX), y: Math.round(centerY) });
  }, []);

  // 2. Render Mermaid diagram into SVG
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setRenderError(null);

    const renderMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'dark',
          themeVariables: {
            darkMode: true,
            background: '#0a0a0a',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '13px',
            lineColor: '#525252',
            mainBkg: '#121212',
            nodeBorder: '#3b82f6',
          },
          securityLevel: 'loose',
          suppressErrorRendering: true,
          flowchart: {
            useMaxWidth: false,
            htmlLabels: false,
            curve: 'basis',
            nodeSpacing: 45,
            rankSpacing: 50,
          },
        });

        // Use a unique element ID
        const uniqueId = `mermaid_gitkit_${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(uniqueId, mermaidCode);

        // Clean up any temporary mermaid container left in document.body
        const tempContainer = document.getElementById(`d${uniqueId}`);
        if (tempContainer) {
          tempContainer.remove();
        }

        if (isMounted) {
          setSvgContent(svg);
          setLoading(false);
          // Auto-fit diagram once DOM renders
          setTimeout(() => {
            if (isMounted) {
              autoFitDiagram();
            }
          }, 60);
        }
      } catch (err) {
        console.error('Failed to render Mermaid chart:', err);
        if (isMounted) {
          setRenderError(err instanceof Error ? err.message : 'Failed to render Mermaid diagram');
          setLoading(false);
        }
      }
    };

    void renderMermaid();

    return () => {
      isMounted = false;
    };
  }, [mermaidCode, autoFitDiagram]);

  // 3. Setup Node click event listeners inside rendered SVG
  useEffect(() => {
    if (!diagramWrapperRef.current || !svgContent) return;

    const wrapper = diagramWrapperRef.current;
    const nodeElements = wrapper.querySelectorAll<SVGGElement>('g.node');

    const handleNodeClick = (e: MouseEvent) => {
      // If the user was dragging/panning the canvas, ignore the click
      if (dragDistanceRef.current > 5) return;

      const target = e.currentTarget as Element;
      const idAttr = target.id || '';
      const text = target.textContent || '';

      const matchedNode = graph.nodes.find((n) => {
        const safeId = sanitizeMermaidId(n.id);
        return idAttr.includes(safeId) || text.includes(n.label);
      });

      if (matchedNode) {
        setSelectedNode((prev) => (prev?.id === matchedNode.id ? null : matchedNode));
      }
    };

    nodeElements.forEach((el) => {
      el.addEventListener('click', handleNodeClick as EventListener);
      el.style.cursor = 'pointer';
    });

    return () => {
      nodeElements.forEach((el) => {
        el.removeEventListener('click', handleNodeClick as EventListener);
      });
    };
  }, [svgContent, graph.nodes]);

  // 4. Highlight Selected Node
  useEffect(() => {
    if (!diagramWrapperRef.current) return;
    const wrapper = diagramWrapperRef.current;
    const nodeElements = wrapper.querySelectorAll<SVGGElement>('g.node');

    nodeElements.forEach((el) => {
      const isSelected =
        selectedNode &&
        (el.id.includes(sanitizeMermaidId(selectedNode.id)) ||
          (el.textContent && el.textContent.includes(selectedNode.label)));

      const shape = el.querySelector<SVGGraphicsElement>('rect, polygon, circle, path');
      if (shape) {
        if (isSelected) {
          shape.style.stroke = '#10b981';
          shape.style.strokeWidth = '3px';
          shape.style.filter = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.6))';
        } else {
          shape.style.stroke = '';
          shape.style.strokeWidth = '';
          shape.style.filter = '';
        }
      }
    });
  }, [selectedNode]);

  // 5. Highlight Search Query Matches
  useEffect(() => {
    if (!diagramWrapperRef.current) return;
    const wrapper = diagramWrapperRef.current;
    const nodeElements = wrapper.querySelectorAll<SVGGElement>('g.node');
    const q = searchQuery.toLowerCase().trim();

    nodeElements.forEach((el) => {
      if (!q) {
        el.style.opacity = '1';
        return;
      }
      const text = (el.textContent || '').toLowerCase();
      const isMatch = text.includes(q);
      el.style.opacity = isMatch ? '1' : '0.2';
      el.style.transition = 'opacity 0.15s ease-in-out';
    });
  }, [searchQuery]);

  // 6. Smooth Pan Handlers with Window Listeners
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    if ((e.target as HTMLElement).closest('button, input, a, [role="button"]')) return;

    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    dragDistanceRef.current = 0;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dy = moveEvent.clientY - dragStartRef.current.startY;
      dragDistanceRef.current = Math.hypot(dx, dy);

      setPan({
        x: dragStartRef.current.panX + dx,
        y: dragStartRef.current.panY + dy,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 7. Pointer-centric Wheel Zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const nextScale = Math.max(0.15, Math.min(3.5, scale * zoomFactor));

    const newPanX = mouseX - (mouseX - pan.x) * (nextScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (nextScale / scale);

    setScale(Number(nextScale.toFixed(3)));
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  // 8. Zoom in / out buttons (relative to canvas center)
  const handleZoomIn = () => {
    if (!containerRef.current) return;
    const centerX = containerRef.current.clientWidth / 2;
    const centerY = containerRef.current.clientHeight / 2;
    const nextScale = Math.min(3.5, scale * 1.25);
    const newPanX = centerX - (centerX - pan.x) * (nextScale / scale);
    const newPanY = centerY - (centerY - pan.y) * (nextScale / scale);
    setScale(Number(nextScale.toFixed(3)));
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  const handleZoomOut = () => {
    if (!containerRef.current) return;
    const centerX = containerRef.current.clientWidth / 2;
    const centerY = containerRef.current.clientHeight / 2;
    const nextScale = Math.max(0.15, scale * 0.8);
    const newPanX = centerX - (centerX - pan.x) * (nextScale / scale);
    const newPanY = centerY - (centerY - pan.y) * (nextScale / scale);
    setScale(Number(nextScale.toFixed(3)));
    setPan({ x: Math.round(newPanX), y: Math.round(newPanY) });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy diagram code:', err);
    }
  };

  // 9. Standardized Clean Exports
  const handleExportPng = useCallback(async () => {
    if (!diagramWrapperRef.current) return;
    const svgEl = diagramWrapperRef.current.querySelector('svg');
    if (!svgEl) return;

    try {
      const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.style.backgroundColor = '#0a0a0a';
      const svgString = new XMLSerializer().serializeToString(clonedSvg);

      const blob = await exportSvgToPngBlob(svgString, { scale: 2 });
      downloadBlob(blob, `${owner}-${repo}-architecture.png`);
    } catch (err) {
      console.error('Failed to export PNG:', err);
    }
  }, [owner, repo]);

  const handleExportSvg = useCallback(() => {
    if (!diagramWrapperRef.current) return;
    const svgEl = diagramWrapperRef.current.querySelector('svg');
    if (!svgEl) return;

    try {
      const clonedSvg = svgEl.cloneNode(true) as SVGSVGElement;
      clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clonedSvg.style.backgroundColor = '#0a0a0a';
      const svgString = new XMLSerializer().serializeToString(clonedSvg);
      downloadText(svgString, `${owner}-${repo}-architecture.svg`, 'image/svg+xml');
    } catch (err) {
      console.error('Failed to export SVG:', err);
    }
  }, [owner, repo]);

  // Empty state handling
  if (graph.nodes.length === 0) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center bg-[#0a0a0a] p-6 text-center select-none">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900/80 text-neutral-400">
          <Workflow className="h-8 w-8 text-neutral-500" />
        </div>
        <h3 className="mt-4 font-mono text-base font-semibold text-white">
          No Architectural Subsystems Detected
        </h3>
        <p className="mt-2 max-w-md font-mono text-xs leading-relaxed text-neutral-400">
          Architecture diagrams are automatically synthesized for repositories containing recognized
          application modules, source files, or package manifests.
        </p>
        <div className="mt-6 flex items-center gap-3 font-mono text-xs">
          <a
            href={`/${owner}/${repo}/map`}
            className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-3.5 py-1.5 font-medium text-white transition-colors hover:bg-neutral-700"
          >
            <span>Explore Repo Map</span>
          </a>
          <a
            href={`/${owner}/${repo}`}
            className="flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-3.5 py-1.5 text-neutral-400 transition-colors hover:text-white"
          >
            <span>Back to Overview</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col bg-[#0a0a0a] text-neutral-200 select-none">
      {/* Toolbar Header */}
      <div className="z-20 flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 bg-[#0d1117] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="font-mono text-xs font-semibold text-white">System Architecture</span>
          </div>

          <div className="hidden items-center gap-1.5 font-mono text-[11px] text-neutral-400 sm:flex">
            <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5">
              {graph.summary.subsystemsCount} subsystems
            </span>
            <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5">
              {graph.summary.totalComponents} components
            </span>
            <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5">
              {graph.summary.relationshipsCount} relations
            </span>
          </div>

          {/* Search Filter */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter components..."
              className="h-7 w-36 rounded-md border border-neutral-800 bg-neutral-900/90 pr-7 pl-8 font-mono text-xs text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-700 focus:outline-none sm:w-44"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-neutral-500 hover:text-neutral-300"
                aria-label="Clear filter"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center rounded-md border border-neutral-800 bg-neutral-900 p-0.5">
            <button
              onClick={handleZoomIn}
              className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <span className="w-11 text-center font-mono text-[11px] text-neutral-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={handleZoomOut}
              className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={autoFitDiagram}
              className="ml-0.5 rounded border-l border-neutral-800 p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              title="Fit to Screen"
              aria-label="Fit to Screen"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          {/* Code View Toggle */}
          <button
            onClick={() => setShowCode(!showCode)}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-xs transition-colors ${
              showCode
                ? 'border-emerald-600 bg-emerald-950/40 text-emerald-300'
                : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-white'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>{showCode ? 'Canvas' : 'Mermaid'}</span>
          </button>

          {/* Copy Mermaid Code */}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 font-mono text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white"
            title="Copy Mermaid source"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPng}
            className="flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 font-mono text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white"
            title="Download PNG image"
          >
            <Download className="h-3.5 w-3.5" />
            <span>PNG</span>
          </button>

          {/* Export SVG */}
          <button
            onClick={handleExportSvg}
            className="hidden items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1 font-mono text-xs text-neutral-300 transition-colors hover:border-neutral-700 hover:text-white sm:flex"
            title="Download SVG file"
          >
            <Download className="h-3.5 w-3.5" />
            <span>SVG</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
        className={`relative flex-1 overflow-hidden ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        } bg-[#0a0a0a]`}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#0a0a0a]/80">
            <div className="flex items-center gap-3 font-mono text-xs text-neutral-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              <span>Synthesizing system architecture...</span>
            </div>
          </div>
        )}

        {renderError && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="max-w-md rounded-lg border border-rose-900/50 bg-rose-950/20 p-5 text-center">
              <p className="font-mono text-sm font-semibold text-rose-400">Mermaid Render Error</p>
              <p className="mt-2 font-mono text-xs text-neutral-400">{renderError}</p>
            </div>
          </div>
        )}

        {showCode ? (
          /* Raw Mermaid Editor/Viewer */
          <div className="absolute inset-0 z-10 overflow-auto bg-[#0c1014] p-6 font-mono text-xs text-neutral-300">
            <div className="mb-3 flex items-center justify-between text-neutral-400">
              <span>Mermaid Diagram Source (100% Deterministic)</span>
              <button
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-[11px] text-white hover:bg-neutral-700"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <pre className="overflow-x-auto rounded border border-neutral-800 bg-[#080a0d] p-4 font-mono leading-relaxed text-emerald-400">
              {mermaidCode}
            </pre>
          </div>
        ) : (
          /* Rendered Interactive Diagram */
          <div
            ref={diagramWrapperRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            }}
            className="inline-block p-12 select-none"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}

        {/* Bottom Guidance Bar */}
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-md border border-neutral-800/80 bg-[#0c1014]/90 px-3 py-1.5 font-mono text-[11px] text-neutral-400 shadow-lg backdrop-blur">
          <Info className="h-3.5 w-3.5 text-neutral-500" />
          <span>Click components to inspect • Drag to pan • Scroll to zoom</span>
        </div>
      </div>

      {/* Node Detail Inspector Drawer */}
      {selectedNode && (
        <div className="absolute right-4 bottom-4 z-30 w-80 rounded-lg border border-neutral-800 bg-[#0d1117] p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between border-b border-neutral-800 pb-2">
            <div>
              <span className="font-mono text-xs tracking-wider text-emerald-400 uppercase">
                {selectedNode.type}
              </span>
              <h4 className="mt-0.5 font-mono text-sm font-semibold text-white">
                {selectedNode.label}
              </h4>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="mt-3 space-y-2 font-mono text-xs text-neutral-300">
            {selectedNode.groupId && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-500">Subsystem:</span>
                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-300">
                  {selectedNode.groupId}
                </span>
              </div>
            )}

            {selectedNode.path && (
              <div>
                <span className="text-neutral-500">Path:</span>
                <p className="mt-0.5 truncate rounded border border-neutral-800/80 bg-neutral-900 p-1.5 text-neutral-300">
                  {selectedNode.path}
                </p>
              </div>
            )}

            {selectedNode.path && (
              <a
                href={`https://github.com/${owner}/${repo}/blob/${metadata.defaultBranch}/${selectedNode.path}`}
                target="_blank"
                rel="noreferrer"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 py-1.5 text-xs font-medium text-white transition-colors hover:bg-neutral-700"
              >
                <span>View on GitHub</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
