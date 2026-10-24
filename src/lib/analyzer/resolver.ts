import type { DependencyEdgeKind } from '@/types/dependency';

export interface ModuleResolutionResult {
  readonly kind: DependencyEdgeKind;
  readonly target: string;
  readonly rawSpecifier: string;
}

const JS_TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

/**
 * Deterministically resolves an import specifier to an internal file path or an external package name.
 */
export function resolveModuleSpecifier(
  rawSpecifier: string,
  importerPath: string,
  allRepoPaths: Set<string> | readonly string[]
): ModuleResolutionResult {
  const repoPaths = allRepoPaths instanceof Set ? allRepoPaths : new Set(allRepoPaths);
  const specifier = rawSpecifier.trim();

  // 1. Relative import (starts with . or ..)
  if (
    specifier.startsWith('./') ||
    specifier.startsWith('../') ||
    specifier === '.' ||
    specifier === '..'
  ) {
    const resolvedPath = resolveRelativePath(importerPath, specifier, repoPaths);
    if (resolvedPath) {
      return {
        kind: 'internal',
        target: resolvedPath,
        rawSpecifier: specifier,
      };
    }
    // Could not match any file in the repository tree
    const fallbackPath = normalizeRelativePath(getDirectory(importerPath), specifier);
    return {
      kind: 'unresolved',
      target: fallbackPath,
      rawSpecifier: specifier,
    };
  }

  // 2. Standard path alias (@/ or ~/)
  if (specifier.startsWith('@/') || specifier.startsWith('~/')) {
    const aliasStripped = specifier.slice(2);
    // Try matching in src/ or repository root
    const candidates = [`src/${aliasStripped}`, aliasStripped];

    for (const candidate of candidates) {
      const match = matchCandidateExtensions(candidate, repoPaths);
      if (match) {
        return {
          kind: 'internal',
          target: match,
          rawSpecifier: specifier,
        };
      }
    }
  }

  // 3. Python relative import (starts with one or more leading dots, e.g. .models or ..lib)
  if (importerPath.endsWith('.py') && specifier.startsWith('.')) {
    const pyMatch = resolvePythonRelativeImport(importerPath, specifier, repoPaths);
    if (pyMatch) {
      return {
        kind: 'internal',
        target: pyMatch,
        rawSpecifier: specifier,
      };
    }
    return {
      kind: 'unresolved',
      target: specifier,
      rawSpecifier: specifier,
    };
  }

  // 4. Python top-level internal module check
  if (importerPath.endsWith('.py')) {
    // E.g. "import my_package" or "from my_package.sub import foo"
    const topModule = specifier.split('.')[0];
    const topCandidates = [
      `${topModule}.py`,
      `${topModule}/__init__.py`,
      `src/${topModule}.py`,
      `src/${topModule}/__init__.py`,
    ];

    for (const candidate of topCandidates) {
      if (repoPaths.has(candidate)) {
        // Internal Python module
        const dottedPath = specifier.replace(/\./g, '/');
        const exactMatch =
          matchCandidateExtensions(dottedPath, repoPaths) ||
          matchCandidateExtensions(`src/${dottedPath}`, repoPaths);
        return {
          kind: 'internal',
          target: exactMatch || candidate,
          rawSpecifier: specifier,
        };
      }
    }
  }

  // 5. Bare specifier -> External third-party package
  const canonicalPackage = extractCanonicalPackageName(specifier);
  return {
    kind: 'external',
    target: canonicalPackage,
    rawSpecifier: specifier,
  };
}

/**
 * Resolves a relative JS/TS path using extension and index matching against repository tree paths.
 */
function resolveRelativePath(
  importerPath: string,
  specifier: string,
  allRepoPaths: Set<string>
): string | null {
  const importerDir = getDirectory(importerPath);
  const normalized = normalizeRelativePath(importerDir, specifier);

  // Exact file match
  if (allRepoPaths.has(normalized)) {
    return normalized;
  }

  // Try appending JS/TS extensions
  return matchCandidateExtensions(normalized, allRepoPaths);
}

/**
 * Tests candidate file path with common extensions and directory index files.
 */
function matchCandidateExtensions(basePath: string, allRepoPaths: Set<string>): string | null {
  if (allRepoPaths.has(basePath)) {
    return basePath;
  }

  for (const ext of JS_TS_EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (allRepoPaths.has(candidate)) {
      return candidate;
    }
  }

  // Directory index files: basePath/index.ts, etc.
  for (const ext of JS_TS_EXTENSIONS) {
    const indexCandidate = `${basePath}/index${ext}`;
    if (allRepoPaths.has(indexCandidate)) {
      return indexCandidate;
    }
  }

  // Python file: basePath.py or basePath/__init__.py
  if (allRepoPaths.has(`${basePath}.py`)) {
    return `${basePath}.py`;
  }
  if (allRepoPaths.has(`${basePath}/__init__.py`)) {
    return `${basePath}/__init__.py`;
  }

  return null;
}

/**
 * Resolves Python relative imports like `.models` or `..utils`.
 */
function resolvePythonRelativeImport(
  importerPath: string,
  specifier: string,
  allRepoPaths: Set<string>
): string | null {
  const dotMatch = /^(\.+)(.*)$/.exec(specifier);
  if (!dotMatch) return null;

  const dots = dotMatch[1].length; // 1 = same dir, 2 = parent dir, etc.
  const rest = dotMatch[2].replace(/\./g, '/');

  let currentDir = getDirectory(importerPath);
  for (let i = 1; i < dots; i++) {
    currentDir = getDirectory(currentDir);
  }

  const candidateBase = rest ? `${currentDir}/${rest}` : currentDir;
  return matchCandidateExtensions(candidateBase, allRepoPaths);
}

/**
 * Normalizes relative path segments like `.` and `..` deterministically.
 */
function normalizeRelativePath(dir: string, relative: string): string {
  const parts = dir ? dir.split('/') : [];
  const segments = relative.split('/');

  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (parts.length > 0) parts.pop();
    } else {
      parts.push(segment);
    }
  }

  return parts.join('/');
}

function getDirectory(path: string): string {
  const slashIndex = path.lastIndexOf('/');
  return slashIndex !== -1 ? path.slice(0, slashIndex) : '';
}

/**
 * Extracts the canonical package name from a specifier.
 * E.g. `@octokit/rest/plugins` -> `@octokit/rest`
 * E.g. `lodash/fp/map` -> `lodash`
 */
export function extractCanonicalPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}
