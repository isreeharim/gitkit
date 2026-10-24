import type { RepositoryTree } from '@/types/repository';
import type {
  StructureMetrics,
  LargestFileMetric,
  DirectorySizeMetric,
  DeepestPathMetric,
  FileTypeMetric,
  LanguageMetric,
} from '@/types/metrics';
import { formatBytes } from '@/lib/utils';
import { detectLanguage, getFileExtension, isSourceCodeFile } from './language-detector';
import { isGeneratedOrVendor } from './exclusion-rules';

export interface StructureAnalysisOptions {
  topFilesLimit?: number;
  topDirsLimit?: number;
  deepestPathsLimit?: number;
}

/**
 * Deterministically analyzes repository tree entries to compute structural metrics,
 * directory size aggregations, deepest paths, and language/file-type distributions.
 */
export function analyzeRepositoryStructure(
  tree: RepositoryTree,
  options: StructureAnalysisOptions = {}
): StructureMetrics {
  const topFilesLimit = options.topFilesLimit ?? 8;
  const topDirsLimit = options.topDirsLimit ?? 6;
  const deepestPathsLimit = options.deepestPathsLimit ?? 5;

  const blobEntries = tree.entries.filter((e) => e.type === 'blob');
  const treeDirEntries = tree.entries.filter((e) => e.type === 'tree');

  let maxDepth = 0;
  let sourceFilesCount = 0;
  let nonSourceFilesCount = 0;
  let generatedFilesCount = 0;

  // 1. Language and extension aggregations
  const extMap = new Map<string, { count: number; bytes: number }>();
  const langMap = new Map<string, { color: string; count: number; bytes: number }>();
  let totalTreeBytes = 0;

  // 2. Directory size tracking: dirPath -> { bytes, files }
  const dirSizeMap = new Map<string, { bytes: number; files: number }>();

  // Deepest paths collection
  const allPathDepths: { path: string; depth: number; segments: string[] }[] = [];

  for (const entry of blobEntries) {
    const size = entry.size || 0;
    totalTreeBytes += size;

    const segments = entry.path.split('/');
    const depth = segments.length;
    if (depth > maxDepth) {
      maxDepth = depth;
    }
    allPathDepths.push({ path: entry.path, depth, segments });

    // Exclusion and source classification
    const isGen = isGeneratedOrVendor(entry.path);
    if (isGen) {
      generatedFilesCount++;
    }

    if (isSourceCodeFile(entry.path)) {
      sourceFilesCount++;
    } else {
      nonSourceFilesCount++;
    }

    // Extension statistics
    const ext = getFileExtension(entry.path) || '(no extension)';
    const extData = extMap.get(ext) || { count: 0, bytes: 0 };
    extData.count++;
    extData.bytes += size;
    extMap.set(ext, extData);

    // Language statistics
    const lang = detectLanguage(entry.path);
    if (lang) {
      const langData = langMap.get(lang.name) || { color: lang.color, count: 0, bytes: 0 };
      langData.count++;
      langData.bytes += size;
      langMap.set(lang.name, langData);
    } else {
      const otherData = langMap.get('Other') || { color: '#8b949e', count: 0, bytes: 0 };
      otherData.count++;
      otherData.bytes += size;
      langMap.set('Other', otherData);
    }

    // Bottom-up aggregate bytes into all parent directory paths
    for (let i = 1; i < segments.length; i++) {
      const dirPath = segments.slice(0, i).join('/');
      const dirData = dirSizeMap.get(dirPath) || { bytes: 0, files: 0 };
      dirData.bytes += size;
      dirData.files += 1;
      dirSizeMap.set(dirPath, dirData);
    }
  }

  // Also calculate maxDepth for empty directories if deeper than files
  for (const dirEntry of treeDirEntries) {
    const depth = dirEntry.path.split('/').length;
    if (depth > maxDepth) {
      maxDepth = depth;
    }
  }

  // 3. Largest files
  const sortedFiles: LargestFileMetric[] = blobEntries
    .slice()
    .sort((a, b) => (b.size || 0) - (a.size || 0))
    .slice(0, topFilesLimit)
    .map((e) => ({
      path: e.path,
      name: e.name,
      sizeBytes: e.size || 0,
      formattedSize: formatBytes(e.size || 0),
      extension: getFileExtension(e.path),
      isGenerated: isGeneratedOrVendor(e.path),
    }));

  // 4. Largest directories
  const sortedDirs: DirectorySizeMetric[] = Array.from(dirSizeMap.entries())
    .map(([path, data]) => ({
      path,
      fileCount: data.files,
      totalBytes: data.bytes,
      formattedSize: formatBytes(data.bytes),
      depth: path.split('/').length,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes)
    .slice(0, topDirsLimit);

  // 5. Deepest paths
  const sortedDeepest: DeepestPathMetric[] = allPathDepths
    .sort((a, b) => b.depth - a.depth || a.path.localeCompare(b.path))
    .slice(0, deepestPathsLimit)
    .map((d) => ({
      path: d.path,
      depth: d.depth,
      segments: d.segments,
    }));

  // 6. File Types
  const totalFiles = blobEntries.length;
  const fileTypes: FileTypeMetric[] = Array.from(extMap.entries())
    .map(([extension, data]) => ({
      extension,
      label: extension === '(no extension)' ? 'No extension' : extension,
      fileCount: data.count,
      totalBytes: data.bytes,
      percentageBytes: totalTreeBytes > 0 ? (data.bytes / totalTreeBytes) * 100 : 0,
      percentageFiles: totalFiles > 0 ? (data.count / totalFiles) * 100 : 0,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);

  // 7. Languages
  const languages: LanguageMetric[] = Array.from(langMap.entries())
    .map(([name, data]) => ({
      name,
      color: data.color,
      fileCount: data.count,
      totalBytes: data.bytes,
      percentageBytes: totalTreeBytes > 0 ? (data.bytes / totalTreeBytes) * 100 : 0,
      percentageFiles: totalFiles > 0 ? (data.count / totalFiles) * 100 : 0,
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);

  return {
    totalFiles,
    totalDirectories: treeDirEntries.length,
    maxDepth,
    sourceFilesCount,
    nonSourceFilesCount,
    generatedFilesCount,
    largestFiles: sortedFiles,
    largestDirectories: sortedDirs,
    deepestPaths: sortedDeepest,
    fileTypes,
    languages,
  };
}
