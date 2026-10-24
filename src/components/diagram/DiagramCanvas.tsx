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
} from 'lucide-react';
import type { DiagramGraph, DiagramNode } from '@/types/diagram';
import type { RepositoryMetadata } from '@/types/repository';

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

  // Pan & Zoom state
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramWrapperRef = useRef<HTMLDivElement>(null);

  // 1. Render Mermaid diagram into SVG
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
          flowchart: {
            useMaxWidth: false,
            htmlLabels: true,
            curve: 'basis',
            nodeSpacing: 45,
            rankSpacing: 50,
          },
        });

        const id = `mermaid-gitkit-${Date.now()}`;
        const { svg } = await mermaid.render(id, mermaidCode);

        if (isMounted) {
          setSvgContent(svg);
          setLoading(false);
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
  }, [mermaidCode]);

  // 2. Setup Node click event listeners inside rendered SVG
  useEffect(() => {
    if (!diagramWrapperRef.current || !svgContent) return;

    const wrapper = diagramWrapperRef.current;
    const nodeElements = wrapper.querySelectorAll('g.node');

    const handleNodeClick = (e: Event) => {
      const target = e.currentTarget as Element;
      const idAttr = target.id;
      // Mermaid node ID format: "flowchart-node_name-timestamp"
      const matchedNode = graph.nodes.find((n) => {
        const safeId = n.id.replace(/[^a-zA-Z0-9_]/g, '_');
        return idAttr && idAttr.includes(safeId);
      });

      if (matchedNode) {
        setSelectedNode(matchedNode);
      }
    };

    nodeElements.forEach((el) => {
      el.addEventListener('click', handleNodeClick);
      (el as HTMLElement).style.cursor = 'pointer';
    });

    return () => {
      nodeElements.forEach((el) => {
        el.removeEventListener('click', handleNodeClick);
      });
    };
  }, [svgContent, graph.nodes]);

  // 3. Pan and zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setScale((prevScale) => Math.max(0.2, Math.min(4, prevScale * zoomFactor)));
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(4, s * 1.25));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.2, s * 0.8));
  };

  const handleResetFit = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
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

  const handleExportPng = useCallback(() => {
    if (!diagramWrapperRef.current) return;
    const svgEl = diagramWrapperRef.current.querySelector('svg');
    if (!svgEl) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);
      const image = new Image();

      image.onload = () => {
        const canvas = document.createElement('canvas');
        const scaleFactor = 2; // 2x high-DPI export
        const width = svgEl.viewBox.baseVal?.width || svgEl.clientWidth || 1000;
        const height = svgEl.viewBox.baseVal?.height || svgEl.clientHeight || 700;

        canvas.width = width * scaleFactor;
        canvas.height = (height + 40) * scaleFactor;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, width * scaleFactor, height * scaleFactor);

        // Watermark footer
        ctx.fillStyle = '#525252';
        ctx.font = '500 24px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(
          `GitKit Architecture • ${owner}/${repo}`,
          canvas.width - 24,
          canvas.height - 18
        );

        canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `${owner}-${repo}-architecture.png`;
          anchor.click();
          anchor.remove();
          URL.revokeObjectURL(url);
        }, 'image/png');

        URL.revokeObjectURL(svgUrl);
      };

      image.src = svgUrl;
    } catch (err) {
      console.error('Failed to export PNG:', err);
    }
  }, [owner, repo]);

  const handleExportSvg = useCallback(() => {
    if (!diagramWrapperRef.current) return;
    const svgEl = diagramWrapperRef.current.querySelector('svg');
    if (!svgEl) return;

    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${owner}-${repo}-architecture.svg`;
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [owner, repo]);

  return (
    <div className="relative flex h-full w-full flex-col bg-[#0a0a0a] text-neutral-200 select-none">
      {/* Toolbar Header */}
      <div className="z-20 flex flex-wrap items-center justify-between border-b border-neutral-800 bg-[#0d1117] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="font-mono text-xs font-semibold text-white">System Architecture</span>
          </div>

          <div className="hidden items-center gap-2 font-mono text-[11px] text-neutral-400 sm:flex">
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
            <span className="px-1.5 font-mono text-[11px] text-neutral-300">
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
              onClick={handleResetFit}
              className="ml-0.5 rounded border-l border-neutral-800 p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
              title="Reset View"
              aria-label="Reset View"
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
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
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
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
            className="inline-block p-12 transition-transform duration-75 select-none"
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
