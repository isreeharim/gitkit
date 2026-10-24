import type { ExportFormat, ExportTarget } from '@/types/export';

export interface FilenameOptions {
  readonly owner: string;
  readonly repo: string;
  readonly target: ExportTarget;
  readonly format: ExportFormat;
  readonly includeTimestamp?: boolean;
  readonly timestamp?: Date | string;
}

/**
 * Sanitizes a string component for safe use in file systems across platforms.
 */
function sanitizeSegment(segment: string): string {
  return segment
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/**
 * Formats a Date object to YYYYMMDD string deterministically.
 */
function formatDate(dateInput?: Date | string): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) {
    return '20261024';
  }
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Maps ExportFormat to its canonical standard file extension.
 */
export function getFormatExtension(format: ExportFormat): string {
  switch (format) {
    case 'svg':
      return 'svg';
    case 'png':
      return 'png';
    case 'mermaid':
      return 'mmd';
    case 'json':
      return 'json';
  }
}

/**
 * Generates a deterministic, platform-safe filename for GitKit exports.
 *
 * Example:
 * `gitkit-octocat-hello-world-repomap.svg`
 * `gitkit-octocat-hello-world-dependencies-20261024.mmd`
 */
export function generateExportFilename(options: FilenameOptions): string {
  const safeOwner = sanitizeSegment(options.owner) || 'owner';
  const safeRepo = sanitizeSegment(options.repo) || 'repo';
  const safeTarget = sanitizeSegment(options.target);
  const ext = getFormatExtension(options.format);

  const parts = ['gitkit', safeOwner, safeRepo, safeTarget];

  if (options.includeTimestamp) {
    parts.push(formatDate(options.timestamp));
  }

  return `${parts.join('-')}.${ext}`;
}
