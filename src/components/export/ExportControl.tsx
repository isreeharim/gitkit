import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  X,
  FileCode,
  Image as ImageIcon,
  Copy,
  Check,
  Share2,
  Sparkles,
} from 'lucide-react';
import type { ExportFormat, ExportTarget } from '@/types/export';
import type { RepositoryMetadata } from '@/types/repository';
import type { RepoGraph } from '@/lib/graph/graph-model';
import type { DependencyGraph } from '@/types/dependency';
import type { RepositoryMetricsReport } from '@/types/metrics';
import type { RepositoryHealthReport } from '@/types/health';
import type { SecurityReport } from '@/types/security';
import { generateExportFilename } from '@/lib/export/filename';
import { generateRepoMapSvg, generateDependencySvg } from '@/lib/export/svg-generator';
import {
  generateRepoStructureMermaid,
  generateDependencyMermaid,
} from '@/lib/export/mermaid-generator';
import { generateExportJson } from '@/lib/export/json-generator';
import { exportSvgToPngBlob } from '@/lib/export/png-exporter';
import { downloadBlob, downloadText } from '@/lib/export/browser-download';

export interface ExportControlProps {
  owner: string;
  repo: string;
  defaultTarget?: ExportTarget;
  repoGraph?: RepoGraph;
  visibleNodeIds?: Set<string>;
  dependencyGraph?: DependencyGraph;
  metadata: RepositoryMetadata;
  metricsReport?: RepositoryMetricsReport;
  healthReport?: RepositoryHealthReport;
  securityReport?: SecurityReport;
  buttonLabel?: string;
  buttonClassName?: string;
}

export function ExportControl({
  owner,
  repo,
  defaultTarget = 'repomap',
  repoGraph,
  visibleNodeIds,
  dependencyGraph,
  metadata,
  metricsReport,
  healthReport,
  securityReport,
  buttonLabel = 'Export',
  buttonClassName,
}: ExportControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<ExportTarget>(defaultTarget);
  const [format, setFormat] = useState<ExportFormat>('svg');
  const [filename, setFilename] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Available targets based on provided data
  const availableTargets = useMemo(() => {
    const list: Array<{ id: ExportTarget; label: string; desc: string }> = [];
    if (repoGraph) {
      list.push({
        id: 'repomap',
        label: 'Repository Map',
        desc: 'Interactive tree hierarchy of directories and files',
      });
    }
    if (dependencyGraph) {
      list.push({
        id: 'dependencies',
        label: 'Dependency Graph',
        desc: 'Internal module imports and external package dependencies',
      });
    }
    list.push({
      id: 'bundle',
      label: 'Complete Analysis',
      desc: 'Normalized metadata, metrics, and architecture payload',
    });
    return list;
  }, [repoGraph, dependencyGraph]);

  // Adjust target if current target is not available
  useEffect(() => {
    if (!availableTargets.some((t) => t.id === target)) {
      if (availableTargets.length > 0) {
        setTarget(availableTargets[0].id);
      }
    }
  }, [availableTargets, target]);

  // If target is bundle, only JSON is supported
  useEffect(() => {
    if (target === 'bundle' && format !== 'json') {
      setFormat('json');
    }
  }, [target, format]);

  // Update default filename when target or format changes
  useEffect(() => {
    const defaultName = generateExportFilename({
      owner,
      repo,
      target,
      format,
    });
    setFilename(defaultName);
    setErrorMsg(null);
  }, [owner, repo, target, format]);

  // Generate content preview (for text formats) or SVG
  const contentPreview = useMemo(() => {
    if (!isOpen) return '';

    try {
      if (format === 'mermaid') {
        if (target === 'repomap' && repoGraph) {
          return generateRepoStructureMermaid(repoGraph, { visibleNodeIds });
        }
        if (target === 'dependencies' && dependencyGraph) {
          return generateDependencyMermaid(dependencyGraph);
        }
      }

      if (format === 'json') {
        return generateExportJson({
          metadata,
          repoGraph: target === 'repomap' || target === 'bundle' ? repoGraph : undefined,
          dependencyGraph:
            target === 'dependencies' || target === 'bundle' ? dependencyGraph : undefined,
          metricsReport,
          healthReport,
          securityReport,
        });
      }

      if (format === 'svg') {
        if (target === 'repomap' && repoGraph) {
          return generateRepoMapSvg(repoGraph, { visibleNodeIds });
        }
        if (target === 'dependencies' && dependencyGraph) {
          return generateDependencySvg(dependencyGraph);
        }
      }
    } catch (err) {
      return `Error generating preview: ${err instanceof Error ? err.message : String(err)}`;
    }

    return '';
  }, [
    isOpen,
    target,
    format,
    repoGraph,
    visibleNodeIds,
    dependencyGraph,
    metadata,
    metricsReport,
    healthReport,
    securityReport,
  ]);

  // Copy text to clipboard
  const handleCopy = async () => {
    if (!contentPreview) return;
    try {
      await navigator.clipboard.writeText(contentPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErrorMsg('Failed to copy to clipboard.');
    }
  };

  // Perform browser-side download
  const handleDownload = async () => {
    setIsExporting(true);
    setErrorMsg(null);

    try {
      const finalFilename =
        filename.trim() || generateExportFilename({ owner, repo, target, format });

      if (format === 'svg') {
        let svg = '';
        if (target === 'repomap' && repoGraph) {
          svg = generateRepoMapSvg(repoGraph, { visibleNodeIds });
        } else if (target === 'dependencies' && dependencyGraph) {
          svg = generateDependencySvg(dependencyGraph);
        } else {
          throw new Error('SVG format is only available for visual graphs.');
        }
        downloadText(svg, finalFilename, 'image/svg+xml');
      } else if (format === 'png') {
        let svg = '';
        if (target === 'repomap' && repoGraph) {
          svg = generateRepoMapSvg(repoGraph, { visibleNodeIds });
        } else if (target === 'dependencies' && dependencyGraph) {
          svg = generateDependencySvg(dependencyGraph);
        } else {
          throw new Error('PNG format is only available for visual graphs.');
        }
        const pngBlob = await exportSvgToPngBlob(svg, { scale: 2 });
        downloadBlob(pngBlob, finalFilename);
      } else if (format === 'mermaid') {
        let mermaidCode = '';
        if (target === 'repomap' && repoGraph) {
          mermaidCode = generateRepoStructureMermaid(repoGraph, { visibleNodeIds });
        } else if (target === 'dependencies' && dependencyGraph) {
          mermaidCode = generateDependencyMermaid(dependencyGraph);
        } else {
          throw new Error('Mermaid format is only available for graph structures.');
        }
        downloadText(mermaidCode, finalFilename, 'text/vnd.mermaid');
      } else if (format === 'json') {
        const jsonCode = generateExportJson({
          metadata,
          repoGraph: target === 'repomap' || target === 'bundle' ? repoGraph : undefined,
          dependencyGraph:
            target === 'dependencies' || target === 'bundle' ? dependencyGraph : undefined,
          metricsReport,
          healthReport,
          securityReport,
        });
        downloadText(jsonCode, finalFilename, 'application/json');
      }

      setIsOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const modalContent = isOpen ? (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
      <div
        className="animate-in fade-in zoom-in-95 w-full max-w-2xl rounded-xl border border-neutral-800 bg-[#0e1011] p-6 font-mono text-neutral-200 shadow-2xl duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-md border border-neutral-700 bg-neutral-800/80 p-1.5 text-neutral-300">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h2 id="export-dialog-title" className="text-sm font-bold text-white">
                Export GitKit Analysis
              </h2>
              <p className="text-[11px] text-neutral-400">
                Deterministic client-side export • Zero external services
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            aria-label="Close export dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Target Data Selector */}
          <div>
            <label className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
              Target Dataset
            </label>
            <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {availableTargets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTarget(t.id)}
                  className={`flex flex-col rounded-lg border p-2.5 text-left transition-all ${
                    target === t.id
                      ? 'border-blue-500/80 bg-blue-950/20 text-white'
                      : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                  }`}
                >
                  <span className="text-xs font-semibold">{t.label}</span>
                  <span className="mt-1 text-[10px] leading-tight text-neutral-500">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
              Export Format
            </label>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                {
                  id: 'svg' as ExportFormat,
                  label: 'SVG',
                  badge: 'Vector',
                  icon: FileCode,
                  disabled: target === 'bundle',
                },
                {
                  id: 'png' as ExportFormat,
                  label: 'PNG',
                  badge: 'Raster',
                  icon: ImageIcon,
                  disabled: target === 'bundle',
                },
                {
                  id: 'mermaid' as ExportFormat,
                  label: 'Mermaid',
                  badge: '.mmd',
                  icon: Sparkles,
                  disabled: target === 'bundle',
                },
                {
                  id: 'json' as ExportFormat,
                  label: 'JSON',
                  badge: 'Schema v1.0',
                  icon: FileCode,
                  disabled: false,
                },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={f.disabled}
                    onClick={() => setFormat(f.id)}
                    className={`flex items-center justify-between rounded-lg border p-2.5 text-left transition-all ${
                      f.disabled
                        ? 'cursor-not-allowed border-neutral-800/40 bg-neutral-900/20 text-neutral-600'
                        : format === f.id
                          ? 'border-blue-500/80 bg-blue-950/20 text-white'
                          : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{f.label}</span>
                    </div>
                    <span className="text-[9px] text-neutral-500 uppercase">{f.badge}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filename Input */}
          <div>
            <label className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
              Filename
            </label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-neutral-800 bg-black/60 px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-hidden"
              placeholder="Enter filename..."
            />
          </div>

          {/* Preview Box for text/diagram formats */}
          {(format === 'mermaid' || format === 'json') && (
            <div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
                  Preview ({format.toUpperCase()})
                </label>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy snippet</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="mt-1.5 max-h-36 overflow-auto rounded-md border border-neutral-800 bg-black/50 p-2.5 text-[10px] text-neutral-300">
                <code>{contentPreview}</code>
              </pre>
            </div>
          )}

          {/* SVG / PNG info banner */}
          {(format === 'svg' || format === 'png') && (
            <div className="rounded-md border border-neutral-800 bg-neutral-900/40 p-2.5 text-[11px] text-neutral-400">
              {format === 'svg' ? (
                <span>
                  SVG exports include standalone vector markup with embedded dark theme styles,
                  rounded cards, and curved hierarchical paths suitable for Illustrator, Inkscape,
                  or Figma.
                </span>
              ) : (
                <span>
                  PNG exports are rasterized locally in your browser at 2x Retina resolution using
                  HTML5 Canvas. No image data is sent to external servers.
                </span>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="rounded-md border border-rose-900/60 bg-rose-950/40 p-2.5 text-xs text-rose-400">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between border-t border-neutral-800 pt-4">
          <span className="text-[10px] text-neutral-500">
            Format: <span className="font-semibold text-neutral-400 uppercase">{format}</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 rounded border border-blue-600 bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExporting ? 'Exporting...' : `Download ${format.toUpperCase()}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        data-export-control="true"
        data-hydrated={mounted ? 'true' : 'false'}
        onClick={() => setIsOpen(true)}
        className={
          buttonClassName ||
          'inline-flex items-center gap-1.5 rounded border border-neutral-700 bg-neutral-800/90 px-2.5 py-1 font-mono text-xs text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-700 hover:text-white'
        }
        title="Export analysis & visualizations"
      >
        <Download className="h-3.5 w-3.5 text-neutral-400" />
        <span>{buttonLabel}</span>
      </button>

      {typeof document !== 'undefined' && modalContent
        ? createPortal(modalContent, document.body)
        : modalContent}
    </>
  );
}
