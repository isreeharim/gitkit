/**
 * Explicit directory names recognized as vendor, build, dependency cache, or generated artifacts.
 */
export const EXCLUDED_DIRECTORIES = new Set<string>([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'out',
  'target',
  '.git',
  '.next',
  '.nuxt',
  '.astro',
  '.svelte-kit',
  'coverage',
  '.nyc_output',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  '.turbo',
  '.cache',
  '.parcel-cache',
  '.docusaurus',
  '.output',
  'bin',
  'obj',
]);

/**
 * Standard lockfiles that should not be counted as handcrafted source code.
 */
export const LOCKFILES = new Set<string>([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  'composer.lock',
  'Gemfile.lock',
  'go.sum',
  'flake.lock',
  'Pipfile.lock',
]);

/**
 * Common minified or compiled file patterns.
 */
const MINIFIED_PATTERNS = [
  /\.min\.[a-z0-9]+$/i,
  /\.bundle\.[a-z0-9]+$/i,
  /\.generated\.[a-z0-9]+$/i,
  /\.map$/i,
];

/**
 * Deterministically checks if a path falls inside an excluded vendor/build/cache directory.
 */
export function isExcludedDirectoryPath(filePath: string): boolean {
  const parts = filePath.split('/');
  // Check if any directory segment matches the excluded list
  for (let i = 0; i < parts.length - 1; i++) {
    if (EXCLUDED_DIRECTORIES.has(parts[i].toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a file is a package manager lockfile.
 */
export function isLockfile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || '';
  return LOCKFILES.has(fileName);
}

/**
 * Checks if a file is minified, bundled, or a source map.
 */
export function isMinifiedOrBundle(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || '';
  return MINIFIED_PATTERNS.some((pattern) => pattern.test(fileName));
}

/**
 * Comprehensive check for whether a file should be excluded from "clean code" calculations.
 */
export function isGeneratedOrVendor(filePath: string): boolean {
  return isExcludedDirectoryPath(filePath) || isLockfile(filePath) || isMinifiedOrBundle(filePath);
}
