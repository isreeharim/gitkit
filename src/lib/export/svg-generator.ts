import type { RepoGraph, RepoGraphNode } from '@/lib/graph/graph-model';
import { computeHierarchicalLayout } from '@/lib/graph/graph-layout';
import type { DependencyGraph, DependencyNode } from '@/types/dependency';
import { computeDependencyLayout } from '@/lib/analyzer/graph-layout';

export interface SvgExportOptions {
  readonly title?: string;
  readonly theme?: 'dark' | 'light';
  readonly padding?: number;
  readonly visibleNodeIds?: Set<string>;
}

/**
 * Escapes characters for safe inclusion in XML/SVG documents.
 */
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Formats byte counts into human-readable strings.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Generates standalone, valid SVG markup for the Repository Map graph.
 */
export function generateRepoMapSvg(graph: RepoGraph, options: SvgExportOptions = {}): string {
  const visibleIds = options.visibleNodeIds || new Set(graph.nodes.keys());
  const padding = options.padding ?? 60;
  const nodeWidth = 260;
  const nodeHeight = 74;

  const positions = computeHierarchicalLayout(graph, visibleIds, {
    nodeWidth,
    nodeHeight,
    horizontalGap: 100,
    verticalGap: 24,
  });

  // Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [id, pos] of positions.entries()) {
    if (!visibleIds.has(id)) continue;
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + nodeWidth);
    maxY = Math.max(maxY, pos.y + nodeHeight);
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 600;
  }

  const headerHeight = 70;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2 + headerHeight);
  const offsetX = padding - minX;
  const offsetY = padding + headerHeight - minY;

  // Build edges
  const edgeElements: string[] = [];
  for (const edge of graph.edges) {
    if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;
    const sourcePos = positions.get(edge.source);
    const targetPos = positions.get(edge.target);
    if (!sourcePos || !targetPos) continue;

    const startX = sourcePos.x + nodeWidth + offsetX;
    const startY = sourcePos.y + nodeHeight / 2 + offsetY;
    const endX = targetPos.x + offsetX;
    const endY = targetPos.y + nodeHeight / 2 + offsetY;

    const midX = (startX + endX) / 2;
    const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    edgeElements.push(
      `<path d="${pathD}" fill="none" stroke="#2e3338" stroke-width="1.5" marker-end="url(#arrow)" />`
    );
  }

  // Build nodes
  const nodeElements: string[] = [];
  for (const [id, pos] of positions.entries()) {
    if (!visibleIds.has(id)) continue;
    const node = graph.nodes.get(id);
    if (!node) continue;

    const x = pos.x + offsetX;
    const y = pos.y + offsetY;

    nodeElements.push(renderRepoNodeSvg(node, x, y, nodeWidth, nodeHeight));
  }

  const title = options.title || 'GitKit Repository Map';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0a0c0e" />
      <stop offset="100%" stop-color="#070809" />
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#525860" />
    </marker>
    <filter id="nodeShadow" x="-5%" y="-10%" width="110%" height="130%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>

  <style>
    .base-text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .header-title { font-size: 16px; font-weight: 700; fill: #f3f4f6; }
    .header-sub { font-size: 11px; fill: #6b7280; }
    .node-title { font-size: 12px; font-weight: 600; fill: #e5e7eb; }
    .node-sub { font-size: 10px; fill: #9ca3af; }
    .badge-text { font-size: 9px; font-weight: 600; }
  </style>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGradient)" />

  <!-- Header -->
  <g transform="translate(${padding}, 36)">
    <circle cx="8" cy="8" r="4" fill="#3b82f6" />
    <text x="22" y="12" class="base-text header-title">${escapeXml(title)}</text>
    <text x="22" y="26" class="base-text header-sub">Deterministic Tree Layout • Exported by GitKit (gitkit.in)</text>
  </g>

  <!-- Edges -->
  <g class="edges">
    ${edgeElements.join('\n    ')}
  </g>

  <!-- Nodes -->
  <g class="nodes">
    ${nodeElements.join('\n    ')}
  </g>
</svg>`;
}

function renderRepoNodeSvg(
  node: RepoGraphNode,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  let borderColor = '#27272a';
  let accentColor = '#3b82f6';
  let badgeLabel = 'FILE';
  let badgeBg = '#18181b';
  let badgeText = '#a1a1aa';
  let subText = '';

  if (node.type === 'repository') {
    borderColor = '#2563eb';
    accentColor = '#60a5fa';
    badgeLabel = 'REPO';
    badgeBg = '#1e3a8a';
    badgeText = '#93c5fd';
    subText = `${node.totalFiles} files • ${formatBytes(node.totalBytes)}`;
  } else if (node.type === 'directory') {
    borderColor = '#059669';
    accentColor = '#34d399';
    badgeLabel = 'DIR';
    badgeBg = '#064e3b';
    badgeText = '#6ee7b7';
    subText = `${node.childFileCount} files • ${node.childDirectoryCount} dirs`;
  } else {
    borderColor = '#3f3f46';
    accentColor = '#a1a1aa';
    badgeLabel = (node.extension || 'FILE').toUpperCase().slice(0, 5);
    badgeBg = '#27272a';
    badgeText = '#d4d4d8';
    subText = formatBytes(node.size);
  }

  const displayName = node.name.length > 24 ? node.name.slice(0, 22) + '…' : node.name;

  return `
    <g transform="translate(${x}, ${y})" filter="url(#nodeShadow)">
      <rect width="${width}" height="${height}" rx="8" fill="#111315" stroke="${borderColor}" stroke-width="1.2" />
      <rect x="0" y="0" width="4" height="${height}" rx="2" fill="${accentColor}" />
      <g transform="translate(14, 22)">
        <text class="base-text node-title">${escapeXml(displayName)}</text>
        <text y="18" class="base-text node-sub">${escapeXml(subText)}</text>
      </g>
      <g transform="translate(${width - 48}, 14)">
        <rect width="36" height="16" rx="4" fill="${badgeBg}" />
        <text x="18" y="11" text-anchor="middle" class="base-text badge-text" fill="${badgeText}">${escapeXml(badgeLabel)}</text>
      </g>
    </g>`;
}

import { ensureDependencyGraph } from '@/lib/analyzer/graph-builder';

/**
 * Generates standalone, valid SVG markup for the Dependency Graph.
 */
export function generateDependencySvg(
  graphInput: DependencyGraph,
  options: SvgExportOptions = {}
): string {
  const graph = ensureDependencyGraph(graphInput);
  const padding = options.padding ?? 60;
  const nodes = Array.from(graph.nodes.values());
  const edges = graph.edges;

  const positions = computeDependencyLayout(nodes, edges, {
    fileNodeWidth: 260,
    fileNodeHeight: 85,
    packageNodeWidth: 220,
    packageNodeHeight: 70,
    columnGap: 120,
    rowGap: 36,
  });

  // Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [id, pos] of positions.entries()) {
    const node = graph.nodes.get(id);
    const w = node?.type === 'package' ? 220 : 260;
    const h = node?.type === 'package' ? 70 : 85;

    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + w);
    maxY = Math.max(maxY, pos.y + h);
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 800;
    maxY = 600;
  }

  const headerHeight = 70;
  const width = Math.ceil(maxX - minX + padding * 2);
  const height = Math.ceil(maxY - minY + padding * 2 + headerHeight);
  const offsetX = padding - minX;
  const offsetY = padding + headerHeight - minY;

  // Build edges
  const edgeElements: string[] = [];
  for (const edge of edges) {
    const sourcePos = positions.get(edge.sourceFile);
    const targetPos = positions.get(edge.target);
    if (!sourcePos || !targetPos) continue;

    const sourceNode = graph.nodes.get(edge.sourceFile);
    const sw = sourceNode?.type === 'package' ? 220 : 260;
    const sh = sourceNode?.type === 'package' ? 70 : 85;

    const targetNode = graph.nodes.get(edge.target);
    const th = targetNode?.type === 'package' ? 70 : 85;

    const startX = sourcePos.x + sw + offsetX;
    const startY = sourcePos.y + sh / 2 + offsetY;
    const endX = targetPos.x + offsetX;
    const endY = targetPos.y + th / 2 + offsetY;

    const isCycle = edge.kind === 'internal' && sourceNode?.type === 'file' && sourceNode.inCycle;
    const strokeColor = isCycle ? '#f43f5e' : edge.kind === 'external' ? '#8b5cf6' : '#3f3f46';
    const marker = isCycle
      ? 'url(#arrow-cycle)'
      : edge.kind === 'external'
        ? 'url(#arrow-ext)'
        : 'url(#arrow)';
    const strokeDash = edge.kind === 'external' ? 'stroke-dasharray="4,4"' : '';

    const midX = (startX + endX) / 2;
    const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
    edgeElements.push(
      `<path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="1.5" ${strokeDash} marker-end="${marker}" />`
    );
  }

  // Build nodes
  const nodeElements: string[] = [];
  for (const [id, pos] of positions.entries()) {
    const node = graph.nodes.get(id);
    if (!node) continue;

    const x = pos.x + offsetX;
    const y = pos.y + offsetY;
    nodeElements.push(renderDependencyNodeSvg(node, x, y));
  }

  const title = options.title || 'GitKit Dependency Graph';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <linearGradient id="depBgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0a0c0e" />
      <stop offset="100%" stop-color="#070809" />
    </linearGradient>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#525860" />
    </marker>
    <marker id="arrow-ext" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#a855f7" />
    </marker>
    <marker id="arrow-cycle" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#f43f5e" />
    </marker>
    <filter id="depShadow" x="-5%" y="-10%" width="110%" height="130%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>

  <style>
    .base-text { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .header-title { font-size: 16px; font-weight: 700; fill: #f3f4f6; }
    .header-sub { font-size: 11px; fill: #6b7280; }
    .node-title { font-size: 12px; font-weight: 600; fill: #e5e7eb; }
    .node-sub { font-size: 10px; fill: #9ca3af; }
    .badge-text { font-size: 9px; font-weight: 600; }
  </style>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#depBgGradient)" />

  <!-- Header -->
  <g transform="translate(${padding}, 36)">
    <circle cx="8" cy="8" r="4" fill="#8b5cf6" />
    <text x="22" y="12" class="base-text header-title">${escapeXml(title)}</text>
    <text x="22" y="26" class="base-text header-sub">Deterministic AST Dependency Analysis • Exported by GitKit (gitkit.in)</text>
  </g>

  <!-- Edges -->
  <g class="edges">
    ${edgeElements.join('\n    ')}
  </g>

  <!-- Nodes -->
  <g class="nodes">
    ${nodeElements.join('\n    ')}
  </g>
</svg>`;
}

function renderDependencyNodeSvg(node: DependencyNode, x: number, y: number): string {
  if (node.type === 'package') {
    const width = 220;
    const height = 70;
    const displayName = node.name.length > 20 ? node.name.slice(0, 18) + '…' : node.name;
    const version = node.versionConstraint || 'latest';

    return `
    <g transform="translate(${x}, ${y})" filter="url(#depShadow)">
      <rect width="${width}" height="${height}" rx="8" fill="#13101c" stroke="#581c87" stroke-width="1.2" />
      <rect x="0" y="0" width="4" height="${height}" rx="2" fill="#a855f7" />
      <g transform="translate(14, 22)">
        <text class="base-text node-title" fill="#e9d5ff">${escapeXml(displayName)}</text>
        <text y="18" class="base-text node-sub" fill="#c084fc">${escapeXml(node.ecosystem)} • ${escapeXml(version)}</text>
      </g>
      <g transform="translate(${width - 48}, 14)">
        <rect width="36" height="16" rx="4" fill="#3b0764" />
        <text x="18" y="11" text-anchor="middle" class="base-text badge-text" fill="#d8b4fe">PKG</text>
      </g>
    </g>`;
  }

  // File node
  const width = 260;
  const height = 85;
  const isCycle = node.inCycle;
  const borderColor = isCycle ? '#e11d48' : '#27272a';
  const accentColor = isCycle ? '#f43f5e' : '#3b82f6';
  const displayName = node.name.length > 22 ? node.name.slice(0, 20) + '…' : node.name;
  const subText = `${node.path}`;
  const displayPath = subText.length > 30 ? '…' + subText.slice(-28) : subText;

  return `
    <g transform="translate(${x}, ${y})" filter="url(#depShadow)">
      <rect width="${width}" height="${height}" rx="8" fill="#111315" stroke="${borderColor}" stroke-width="${isCycle ? 1.5 : 1.2}" />
      <rect x="0" y="0" width="4" height="${height}" rx="2" fill="${accentColor}" />
      <g transform="translate(14, 22)">
        <text class="base-text node-title">${escapeXml(displayName)}</text>
        <text y="18" class="base-text node-sub">${escapeXml(displayPath)}</text>
        <text y="34" class="base-text node-sub" fill="#71717a">In: ${node.inDegree} • Out: ${node.outDegree}${isCycle ? ' • CYCLE' : ''}</text>
      </g>
      <g transform="translate(${width - 48}, 14)">
        <rect width="36" height="16" rx="4" fill="${isCycle ? '#881337' : '#1e293b'}" />
        <text x="18" y="11" text-anchor="middle" class="base-text badge-text" fill="${isCycle ? '#fda4af' : '#93c5fd'}">${escapeXml(node.language.slice(0, 4).toUpperCase())}</text>
      </g>
    </g>`;
}
