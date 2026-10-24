import type { PackageDependency } from '@/types/dependency';

/**
 * Parses a standard npm package.json manifest.
 */
export function parsePackageJson(
  content: string,
  manifestPath = 'package.json'
): PackageDependency[] {
  const result: PackageDependency[] = [];
  try {
    const json = JSON.parse(content);

    // Direct dependencies
    if (json.dependencies && typeof json.dependencies === 'object') {
      for (const [name, version] of Object.entries(json.dependencies)) {
        if (typeof version === 'string') {
          result.push({
            name,
            versionConstraint: version,
            isDev: false,
            manifestSource: manifestPath,
            ecosystem: 'npm',
          });
        }
      }
    }

    // Dev dependencies
    if (json.devDependencies && typeof json.devDependencies === 'object') {
      for (const [name, version] of Object.entries(json.devDependencies)) {
        if (typeof version === 'string') {
          result.push({
            name,
            versionConstraint: version,
            isDev: true,
            manifestSource: manifestPath,
            ecosystem: 'npm',
          });
        }
      }
    }

    // Peer dependencies (treated as non-dev)
    if (json.peerDependencies && typeof json.peerDependencies === 'object') {
      for (const [name, version] of Object.entries(json.peerDependencies)) {
        if (typeof version === 'string' && !result.some((p) => p.name === name)) {
          result.push({
            name,
            versionConstraint: version,
            isDev: false,
            manifestSource: manifestPath,
            ecosystem: 'npm',
          });
        }
      }
    }
  } catch {
    // Graceful return on malformed JSON
  }

  return result;
}

/**
 * Parses Python requirements.txt manifest.
 * Supports ==, >=, <=, ~=, >, <, and unversioned packages.
 */
export function parseRequirementsTxt(
  content: string,
  manifestPath = 'requirements.txt'
): PackageDependency[] {
  const result: PackageDependency[] = [];
  const lines = content.split('\n');

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) continue;

    // Remove inline comments
    const cleanLine = line.split('#')[0].trim();
    if (!cleanLine) continue;

    // Match package name, optional extras like [email], and optional version operator
    const match = /^([a-zA-Z0-9_.-]+)(?:\[[^\]]*\])?(?:\s*([=><~^!]+.*))?$/.exec(cleanLine);
    if (match) {
      const name = match[1];
      const versionConstraint = match[2] ? match[2].trim() : '*';

      result.push({
        name,
        versionConstraint,
        isDev: false,
        manifestSource: manifestPath,
        ecosystem: 'pypi',
      });
    }
  }

  return result;
}

/**
 * Parses Python pyproject.toml manifest for dependencies.
 */
export function parsePyprojectToml(
  content: string,
  manifestPath = 'pyproject.toml'
): PackageDependency[] {
  const result: PackageDependency[] = [];
  const lines = content.split('\n');

  let currentSection = '';
  let inDependenciesArray = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      inDependenciesArray = false;
      continue;
    }

    if (
      (currentSection === 'project' || currentSection === 'project.optional-dependencies') &&
      /^dependencies\s*=\s*\[/.test(line)
    ) {
      inDependenciesArray = true;
      continue;
    }

    if (inDependenciesArray) {
      if (line.includes(']')) {
        inDependenciesArray = false;
      }
      const itemMatch = /^['"]([a-zA-Z0-9_.-]+)(?:\[[^\]]*\])?(?:([=><~^!]+[^'"]*))?['"],?/.exec(
        line
      );
      if (itemMatch) {
        result.push({
          name: itemMatch[1],
          versionConstraint: itemMatch[2] ? itemMatch[2].trim() : '*',
          isDev: currentSection.includes('dev') || currentSection.includes('optional'),
          manifestSource: manifestPath,
          ecosystem: 'pypi',
        });
      }
      continue;
    }

    const isDepSection =
      currentSection === 'project.dependencies' || currentSection === 'tool.poetry.dependencies';
    const isDevSection =
      currentSection === 'tool.poetry.group.dev.dependencies' ||
      currentSection === 'project.optional-dependencies';

    if (isDepSection || isDevSection) {
      // Poetry format: name = "^1.0.0" or name = { version = "^1.0.0" }
      const keyValMatch = /^([a-zA-Z0-9_.-]+)\s*=\s*['"]([^'"]+)['"]/.exec(line);
      if (keyValMatch) {
        result.push({
          name: keyValMatch[1],
          versionConstraint: keyValMatch[2],
          isDev: isDevSection,
          manifestSource: manifestPath,
          ecosystem: 'pypi',
        });
        continue;
      }

      // Standard project.dependencies array items: "requests>=2.0"
      const arrayItemMatch =
        /^['"]([a-zA-Z0-9_.-]+)(?:\[[^\]]*\])?(?:([=><~^!]+[^'"]*))?['"],?$/.exec(line);
      if (arrayItemMatch) {
        result.push({
          name: arrayItemMatch[1],
          versionConstraint: arrayItemMatch[2] ? arrayItemMatch[2].trim() : '*',
          isDev: isDevSection,
          manifestSource: manifestPath,
          ecosystem: 'pypi',
        });
      }
    }
  }

  return result;
}

/**
 * Parses Rust Cargo.toml manifest.
 */
export function parseCargoToml(content: string, manifestPath = 'Cargo.toml'): PackageDependency[] {
  const result: PackageDependency[] = [];
  const lines = content.split('\n');

  let currentSection = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      continue;
    }

    const isDepSection = currentSection === 'dependencies';
    const isDevSection = currentSection === 'dev-dependencies';

    if (isDepSection || isDevSection) {
      // Inline string: serde = "1.0"
      const simpleMatch = /^([a-zA-Z0-9_.-]+)\s*=\s*['"]([^'"]+)['"]/.exec(line);
      if (simpleMatch) {
        result.push({
          name: simpleMatch[1],
          versionConstraint: simpleMatch[2],
          isDev: isDevSection,
          manifestSource: manifestPath,
          ecosystem: 'cargo',
        });
        continue;
      }

      // Table format: serde = { version = "1.0", features = [...] }
      const tableMatch = /^([a-zA-Z0-9_.-]+)\s*=\s*\{.*version\s*=\s*['"]([^'"]+)['"]/.exec(line);
      if (tableMatch) {
        result.push({
          name: tableMatch[1],
          versionConstraint: tableMatch[2],
          isDev: isDevSection,
          manifestSource: manifestPath,
          ecosystem: 'cargo',
        });
      }
    }
  }

  return result;
}

/**
 * Parses Go go.mod manifest.
 */
export function parseGoMod(content: string, manifestPath = 'go.mod'): PackageDependency[] {
  const result: PackageDependency[] = [];
  const lines = content.split('\n');

  let inRequireBlock = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//')) continue;

    if (line === 'require (') {
      inRequireBlock = true;
      continue;
    }
    if (inRequireBlock && line === ')') {
      inRequireBlock = false;
      continue;
    }

    if (inRequireBlock) {
      const match = /^([^\s]+)\s+([^\s]+)/.exec(line);
      if (match) {
        result.push({
          name: match[1],
          versionConstraint: match[2],
          isDev: false,
          manifestSource: manifestPath,
          ecosystem: 'gomod',
        });
      }
      continue;
    }

    // Single line: require github.com/gin-gonic/gin v1.9.0
    const singleMatch = /^require\s+([^\s]+)\s+([^\s]+)/.exec(line);
    if (singleMatch) {
      result.push({
        name: singleMatch[1],
        versionConstraint: singleMatch[2],
        isDev: false,
        manifestSource: manifestPath,
        ecosystem: 'gomod',
      });
    }
  }

  return result;
}
