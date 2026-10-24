import { describe, it, expect } from 'vitest';
import { countLinesOfCode } from '../../src/lib/metrics/loc-counter';
import {
  detectLanguage,
  isSourceCodeFile,
  getFileExtension,
} from '../../src/lib/metrics/language-detector';
import {
  isExcludedDirectoryPath,
  isLockfile,
  isMinifiedOrBundle,
  isGeneratedOrVendor,
} from '../../src/lib/metrics/exclusion-rules';
import { analyzeRepositoryStructure } from '../../src/lib/metrics/structure-analyzer';
import { buildRepositoryMetricsReport } from '../../src/lib/metrics/metrics-engine';
import type { RepositoryMetadata, RepositoryTree } from '../../src/types/repository';

describe('loc-counter (Deterministic Lines of Code)', () => {
  it('handles empty content gracefully', () => {
    const res = countLinesOfCode('', 'src/index.ts');
    expect(res).toEqual({
      totalLines: 0,
      codeLines: 0,
      commentLines: 0,
      blankLines: 0,
    });
  });

  it('counts code, blank, and single-line C-style comments in TypeScript', () => {
    const code = [
      '// File header comment',
      'import React from "react";',
      '',
      '// State declaration',
      'const [count, setCount] = useState(0);',
      '',
      'export default count;',
    ].join('\n');

    const res = countLinesOfCode(code, 'src/Component.tsx');
    expect(res.totalLines).toBe(7);
    expect(res.blankLines).toBe(2);
    expect(res.commentLines).toBe(2);
    expect(res.codeLines).toBe(3);
  });

  it('counts multiline block comments correctly in JS/TS', () => {
    const code = [
      '/*',
      ' * Multiline comment line 1',
      ' * Multiline comment line 2',
      ' */',
      'export const version = "1.0.0";',
    ].join('\n');

    const res = countLinesOfCode(code, 'src/version.ts');
    expect(res.totalLines).toBe(5);
    expect(res.blankLines).toBe(0);
    expect(res.commentLines).toBe(4);
    expect(res.codeLines).toBe(1);
  });

  it('counts Python comments and multiline docstrings', () => {
    const code = [
      '# Single line Python comment',
      'def add(a, b):',
      '    """',
      '    Add two numbers.',
      '    Returns sum.',
      '    """',
      '    return a + b',
      '',
    ].join('\n');

    const res = countLinesOfCode(code, 'math_utils.py');
    expect(res.totalLines).toBe(8);
    expect(res.blankLines).toBe(1);
    expect(res.commentLines).toBe(5); // 1 single-line + 4 docstring lines
    expect(res.codeLines).toBe(2);
  });

  it('counts HTML/Astro block comments', () => {
    const code = [
      '<!-- Component Start -->',
      '<div>',
      '  <span>Hello</span>',
      '</div>',
      '<!-- Component End -->',
    ].join('\n');

    const res = countLinesOfCode(code, 'src/pages/index.astro');
    expect(res.totalLines).toBe(5);
    expect(res.blankLines).toBe(0);
    expect(res.commentLines).toBe(2);
    expect(res.codeLines).toBe(3);
  });

  it('counts lines with trailing comments as code lines', () => {
    const code = 'const maxRetries = 3; // Fallback attempts';
    const res = countLinesOfCode(code, 'config.ts');
    expect(res.totalLines).toBe(1);
    expect(res.codeLines).toBe(1);
    expect(res.commentLines).toBe(0);
    expect(res.blankLines).toBe(0);
  });
});

describe('language-detector', () => {
  it('detects languages by file extension deterministically', () => {
    expect(detectLanguage('src/app.ts')?.name).toBe('TypeScript');
    expect(detectLanguage('src/app.tsx')?.name).toBe('TSX');
    expect(detectLanguage('main.py')?.name).toBe('Python');
    expect(detectLanguage('src/main.rs')?.name).toBe('Rust');
    expect(detectLanguage('server.go')?.name).toBe('Go');
    expect(detectLanguage('index.astro')?.name).toBe('Astro');
    expect(detectLanguage('README.md')?.name).toBe('Markdown');
    expect(detectLanguage('package.json')?.name).toBe('JSON');
  });

  it('detects languages by exact filename', () => {
    expect(detectLanguage('Dockerfile')?.name).toBe('Dockerfile');
    expect(detectLanguage('Makefile')?.name).toBe('Makefile');
    expect(detectLanguage('Gemfile')?.name).toBe('Ruby');
  });

  it('returns null for unknown extensions', () => {
    expect(detectLanguage('data.unknownxyz')).toBeNull();
  });

  it('classifies source code files accurately', () => {
    expect(isSourceCodeFile('src/index.ts')).toBe(true);
    expect(isSourceCodeFile('main.py')).toBe(true);
    expect(isSourceCodeFile('lib.rs')).toBe(true);
    expect(isSourceCodeFile('README.md')).toBe(false);
    expect(isSourceCodeFile('package.json')).toBe(false);
  });

  it('extracts extensions consistently', () => {
    expect(getFileExtension('src/components/Header.tsx')).toBe('.tsx');
    expect(getFileExtension('Dockerfile')).toBe('');
    expect(getFileExtension('archive.tar.gz')).toBe('.gz');
  });
});

describe('exclusion-rules', () => {
  it('identifies vendor, build, and cache directory paths', () => {
    expect(isExcludedDirectoryPath('node_modules/react/index.js')).toBe(true);
    expect(isExcludedDirectoryPath('dist/_astro/client.js')).toBe(true);
    expect(isExcludedDirectoryPath('.git/objects/pack/123')).toBe(true);
    expect(isExcludedDirectoryPath('vendor/bundle/ruby/2.7.0')).toBe(true);
    expect(isExcludedDirectoryPath('src/__pycache__/app.cpython-311.pyc')).toBe(true);
    expect(isExcludedDirectoryPath('target/release/app')).toBe(true);
    expect(isExcludedDirectoryPath('src/components/Header.tsx')).toBe(false);
  });

  it('identifies package manager lockfiles', () => {
    expect(isLockfile('package-lock.json')).toBe(true);
    expect(isLockfile('pnpm-lock.yaml')).toBe(true);
    expect(isLockfile('Cargo.lock')).toBe(true);
    expect(isLockfile('go.sum')).toBe(true);
    expect(isLockfile('package.json')).toBe(false);
  });

  it('identifies minified and source-map files', () => {
    expect(isMinifiedOrBundle('bundle.min.js')).toBe(true);
    expect(isMinifiedOrBundle('styles.min.css')).toBe(true);
    expect(isMinifiedOrBundle('app.js.map')).toBe(true);
    expect(isMinifiedOrBundle('normal.js')).toBe(false);
  });

  it('applies comprehensive isGeneratedOrVendor check', () => {
    expect(isGeneratedOrVendor('node_modules/pkg/index.js')).toBe(true);
    expect(isGeneratedOrVendor('package-lock.json')).toBe(true);
    expect(isGeneratedOrVendor('dist/bundle.min.js')).toBe(true);
    expect(isGeneratedOrVendor('src/index.ts')).toBe(false);
  });
});

describe('structure-analyzer', () => {
  const sampleTree: RepositoryTree = {
    sha: 'tree-sha',
    truncated: false,
    totalFiles: 5,
    totalDirectories: 3,
    totalBytes: 59000,
    entries: [
      { path: 'README.md', name: 'README.md', type: 'blob', mode: '100644', size: 1000, sha: 's1' },
      {
        path: 'package.json',
        name: 'package.json',
        type: 'blob',
        mode: '100644',
        size: 500,
        sha: 's2',
      },
      {
        path: 'src/index.ts',
        name: 'index.ts',
        type: 'blob',
        mode: '100644',
        size: 2500,
        sha: 's3',
      },
      {
        path: 'src/components/Button.tsx',
        name: 'Button.tsx',
        type: 'blob',
        mode: '100644',
        size: 5000,
        sha: 's4',
      },
      {
        path: 'dist/bundle.min.js',
        name: 'bundle.min.js',
        type: 'blob',
        mode: '100644',
        size: 50000,
        sha: 's5',
      },
      { path: 'src', name: 'src', type: 'tree', mode: '040000', sha: 't1' },
      { path: 'src/components', name: 'components', type: 'tree', mode: '040000', sha: 't2' },
      { path: 'dist', name: 'dist', type: 'tree', mode: '040000', sha: 't3' },
    ],
  };

  it('calculates tree depth and deepest paths accurately', () => {
    const structure = analyzeRepositoryStructure(sampleTree);
    expect(structure.maxDepth).toBe(3); // src/components/Button.tsx has depth 3
    expect(structure.deepestPaths[0]?.path).toBe('src/components/Button.tsx');
    expect(structure.deepestPaths[0]?.depth).toBe(3);
  });

  it('sorts largest files and marks generated files', () => {
    const structure = analyzeRepositoryStructure(sampleTree);
    expect(structure.largestFiles[0]?.name).toBe('bundle.min.js');
    expect(structure.largestFiles[0]?.sizeBytes).toBe(50000);
    expect(structure.largestFiles[0]?.isGenerated).toBe(true);

    expect(structure.largestFiles[1]?.name).toBe('Button.tsx');
    expect(structure.largestFiles[1]?.sizeBytes).toBe(5000);
    expect(structure.largestFiles[1]?.isGenerated).toBe(false);
  });

  it('aggregates directory sizes recursively', () => {
    const structure = analyzeRepositoryStructure(sampleTree);
    // "src" contains index.ts (2500) and components/Button.tsx (5000) = 7500 bytes
    const srcDir = structure.largestDirectories.find((d) => d.path === 'src');
    expect(srcDir?.totalBytes).toBe(7500);
    expect(srcDir?.fileCount).toBe(2);

    const compDir = structure.largestDirectories.find((d) => d.path === 'src/components');
    expect(compDir?.totalBytes).toBe(5000);
    expect(compDir?.fileCount).toBe(1);
  });

  it('calculates language and extension distributions', () => {
    const structure = analyzeRepositoryStructure(sampleTree);
    expect(structure.languages.some((l) => l.name === 'TypeScript')).toBe(true);
    expect(structure.languages.some((l) => l.name === 'TSX')).toBe(true);
    expect(structure.languages.some((l) => l.name === 'Markdown')).toBe(true);

    const totalPercentage = structure.languages.reduce((sum, l) => sum + l.percentageBytes, 0);
    expect(Math.round(totalPercentage)).toBe(100);
  });
});

describe('metrics-engine (Unified Report)', () => {
  const sampleMetadata: RepositoryMetadata = {
    owner: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    description: 'A declarative, efficient, and flexible JavaScript library.',
    htmlUrl: 'https://github.com/facebook/react',
    defaultBranch: 'main',
    visibility: 'public',
    isFork: false,
    isArchived: false,
    stars: 220000,
    forks: 45000,
    openIssues: 800,
    watchers: 6500,
    license: { key: 'mit', name: 'MIT License', spdxId: 'MIT', url: null },
    createdAt: '2013-05-24T16:15:54Z',
    updatedAt: '2026-03-01T12:00:00Z',
    pushedAt: '2026-03-01T12:00:00Z',
    language: 'JavaScript',
    topics: ['react', 'javascript', 'ui'],
    homepage: 'https://react.dev',
    sizeKb: 180000,
  };

  const sampleTree: RepositoryTree = {
    sha: 'main-sha',
    truncated: false,
    totalFiles: 2,
    totalDirectories: 1,
    totalBytes: 1500,
    entries: [
      {
        path: 'src/index.ts',
        name: 'index.ts',
        type: 'blob',
        mode: '100644',
        size: 1200,
        sha: 'a1',
      },
      { path: 'README.md', name: 'README.md', type: 'blob', mode: '100644', size: 300, sha: 'a2' },
      { path: 'src', name: 'src', type: 'tree', mode: '040000', sha: 't1' },
    ],
  };

  it('builds complete report with exact provenance and methodology strings', () => {
    const report = buildRepositoryMetricsReport({
      metadata: sampleMetadata,
      tree: sampleTree,
      locResult: {
        totalLines: 100,
        codeLines: 70,
        commentLines: 20,
        blankLines: 10,
        analyzedFilesCount: 1,
        isSampled: false,
        samplingNote: 'Measured across all source files.',
      },
      activity: {
        commitCount: 15420,
        contributorCount: 1650,
        isCommitCountApproximate: false,
        isContributorCountApproximate: false,
      },
    });

    expect(report.repoId).toBe('facebook/react');
    expect(report.repository.stars.value).toBe(220000);
    expect(report.repository.stars.unit).toBe('count');
    expect(report.repository.stars.confidence).toBe('exact');
    expect(report.repository.stars.source).toBe('github_metadata');

    expect(report.code.totalFiles.value).toBe(2);
    expect(report.code.loc.codeLines).toBe(70);
    expect(report.code.loc.commentLines).toBe(20);

    expect(report.activity.commitCount).toBe(15420);
    expect(report.activity.contributorCount).toBe(1650);
  });
});
