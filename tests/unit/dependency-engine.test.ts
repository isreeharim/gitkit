import { describe, it, expect } from 'vitest';
import { JavaScriptTypeScriptParser } from '../../src/lib/parser/js-ts-parser';
import { PythonParser } from '../../src/lib/parser/python-parser';
import {
  parsePackageJson,
  parseRequirementsTxt,
  parsePyprojectToml,
  parseCargoToml,
  parseGoMod,
} from '../../src/lib/parser/manifest-parser';
import { parseManifest } from '../../src/lib/parser';
import { resolveModuleSpecifier } from '../../src/lib/analyzer/resolver';
import { detectCircularDependencies } from '../../src/lib/analyzer/cycle-detector';
import { buildDependencyGraph } from '../../src/lib/analyzer/graph-builder';
import { computeDependencyLayout } from '../../src/lib/analyzer/graph-layout';
import { serializeDependenciesToReactFlow } from '../../src/lib/analyzer/react-flow-adapter';
import { filterDependencyGraph } from '../../src/lib/analyzer/graph-filter';
import type {
  DependencyEdge,
  FileDependencyNode,
  PackageDependencyNode,
} from '../../src/types/dependency';

describe('JavaScriptTypeScriptParser', () => {
  const parser = new JavaScriptTypeScriptParser();

  it('supports js, ts, jsx, tsx, mjs, cjs extensions via canParse', () => {
    expect(parser.canParse('app.ts')).toBe(true);
    expect(parser.canParse('app.tsx')).toBe(true);
    expect(parser.canParse('app.js')).toBe(true);
    expect(parser.canParse('app.jsx')).toBe(true);
    expect(parser.canParse('app.mjs')).toBe(true);
    expect(parser.canParse('app.cjs')).toBe(true);
    expect(parser.canParse('app.py')).toBe(false);
  });

  it('extracts static default, named, and namespace imports with line numbers', () => {
    const code = [
      "import React, { useState, useEffect } from 'react';",
      "import * as path from 'node:path';",
      "import './styles.css';",
    ].join('\n');

    const imports = parser.extractImports(code);
    expect(imports).toHaveLength(3);

    expect(imports[0]).toMatchObject({
      specifier: 'react',
      isTypeOnly: false,
      isDynamic: false,
      line: 1,
    });
    expect(imports[0]?.importedSymbols).toEqual(
      expect.arrayContaining(['React', 'useState', 'useEffect'])
    );

    expect(imports[1]).toMatchObject({
      specifier: 'node:path',
      isTypeOnly: false,
      line: 2,
    });

    expect(imports[2]).toMatchObject({
      specifier: './styles.css',
      isTypeOnly: false,
      line: 3,
    });
  });

  it('extracts type imports', () => {
    const code = "import type { FC, ReactNode } from 'react';";
    const imports = parser.extractImports(code);

    expect(imports).toHaveLength(1);
    expect(imports[0]).toMatchObject({
      specifier: 'react',
      isTypeOnly: true,
      line: 1,
    });
  });

  it('extracts re-exports (export ... from)', () => {
    const code = [
      "export { default as Header } from './Header';",
      "export * from './utils';",
      "export type { Config } from './types';",
    ].join('\n');

    const imports = parser.extractImports(code);
    expect(imports).toHaveLength(3);

    expect(imports[0]).toMatchObject({
      specifier: './Header',
      isTypeOnly: false,
    });
    expect(imports[1]).toMatchObject({
      specifier: './utils',
      isTypeOnly: false,
    });
    expect(imports[2]).toMatchObject({
      specifier: './types',
      isTypeOnly: true,
    });
  });

  it('extracts dynamic imports and require calls', () => {
    const code = ["const Heavy = await import('./heavy');", "const fs = require('fs');"].join('\n');

    const imports = parser.extractImports(code);
    expect(imports).toHaveLength(2);

    expect(imports[0]).toMatchObject({
      specifier: './heavy',
      isDynamic: true,
      line: 1,
    });
    expect(imports[1]).toMatchObject({
      specifier: 'fs',
      isDynamic: false,
      line: 2,
    });
  });

  it('ignores imports inside single-line and multiline comments', () => {
    const code = [
      "// import fake from 'fake-package';",
      '/*',
      " * import anotherFake from 'another-fake';",
      ' */',
      "import real from 'real-package';",
    ].join('\n');

    const imports = parser.extractImports(code);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.specifier).toBe('real-package');
    expect(imports[0]?.line).toBe(5);
  });
});

describe('PythonParser', () => {
  const parser = new PythonParser();

  it('supports py and pyi extensions via canParse', () => {
    expect(parser.canParse('main.py')).toBe(true);
    expect(parser.canParse('main.js')).toBe(false);
  });

  it('extracts standard import statements', () => {
    const code = ['import os, sys', 'import numpy as np'].join('\n');

    const imports = parser.extractImports(code);
    expect(imports).toHaveLength(3);
    expect(imports.map((i) => i.specifier)).toEqual(['os', 'sys', 'numpy']);
  });

  it('extracts from ... import statements with symbols and relative dots', () => {
    const code = [
      'from os.path import join, exists',
      'from .utils import helper',
      'from ..core.engine import run',
    ].join('\n');

    const imports = parser.extractImports(code);
    expect(imports).toHaveLength(3);

    expect(imports[0]?.specifier).toBe('os.path');
    expect(imports[0]?.importedSymbols).toEqual(['join', 'exists']);

    expect(imports[1]?.specifier).toBe('.utils');
    expect(imports[2]?.specifier).toBe('..core.engine');
  });

  it('extracts multiline parenthesized imports', () => {
    const code = [
      'from mypkg.services import (',
      '    AuthService,',
      '    DatabaseService,',
      ')',
    ].join('\n');

    const imports = parser.extractImports(code);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.specifier).toBe('mypkg.services');
    expect(imports[0]?.importedSymbols).toEqual(['AuthService', 'DatabaseService']);
  });

  it('ignores comments and docstrings in Python', () => {
    const code = [
      '"""',
      'from fake import unused',
      '"""',
      '# import comment_fake',
      'import real_module',
    ].join('\n');

    const imports = parser.extractImports(code);
    expect(imports).toHaveLength(1);
    expect(imports[0]?.specifier).toBe('real_module');
  });
});

describe('Manifest Parsers', () => {
  it('parses package.json dependencies, devDependencies, and peerDependencies', () => {
    const content = JSON.stringify({
      dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' },
      devDependencies: { vitest: '^1.0.0', typescript: '^5.0.0' },
      peerDependencies: { tailwindcss: '^3.0.0' },
    });

    const deps = parsePackageJson(content, 'package.json');
    expect(deps).toHaveLength(5);
    expect(deps.find((d) => d.name === 'react')?.isDev).toBe(false);
    expect(deps.find((d) => d.name === 'vitest')?.isDev).toBe(true);
    expect(deps.find((d) => d.name === 'tailwindcss')?.isDev).toBe(false);
    expect(deps.every((d) => d.ecosystem === 'npm')).toBe(true);
  });

  it('parses requirements.txt dependencies ignoring comments and flags', () => {
    const content = [
      '# Core requirements',
      'requests>=2.28.0',
      'fastapi==0.100.0',
      'pydantic[email]~=2.0.0',
      '-e .',
      '# End',
    ].join('\n');

    const deps = parseRequirementsTxt(content, 'requirements.txt');
    expect(deps).toHaveLength(3);
    expect(deps.map((d) => d.name)).toEqual(['requests', 'fastapi', 'pydantic']);
    expect(deps.find((d) => d.name === 'fastapi')?.versionConstraint).toBe('==0.100.0');
    expect(deps.every((d) => d.ecosystem === 'pypi')).toBe(true);
  });

  it('parses pyproject.toml dependencies', () => {
    const content = `
[project]
dependencies = [
    "httpx>=0.24.0",
    "click",
]

[tool.poetry.dependencies]
python = "^3.11"
uvicorn = "^0.22.0"
`;

    const deps = parsePyprojectToml(content, 'pyproject.toml');
    expect(deps.length).toBeGreaterThanOrEqual(3);
    expect(deps.some((d) => d.name === 'httpx')).toBe(true);
    expect(deps.some((d) => d.name === 'uvicorn')).toBe(true);
  });

  it('parses Cargo.toml dependencies', () => {
    const content = `
[package]
name = "my-crate"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
criterion = "0.4"
`;

    const deps = parseCargoToml(content, 'Cargo.toml');
    expect(deps).toHaveLength(3);
    expect(deps.find((d) => d.name === 'serde')?.isDev).toBe(false);
    expect(deps.find((d) => d.name === 'criterion')?.isDev).toBe(true);
    expect(deps.every((d) => d.ecosystem === 'cargo')).toBe(true);
  });

  it('parses go.mod dependencies', () => {
    const content = `
module github.com/example/app

go 1.21

require (
    github.com/gin-gonic/gin v1.9.1
    golang.org/x/crypto v0.14.0 // indirect
)

require github.com/stretchr/testify v1.8.4
`;

    const deps = parseGoMod(content, 'go.mod');
    expect(deps).toHaveLength(3);
    expect(deps.map((d) => d.name)).toEqual([
      'github.com/gin-gonic/gin',
      'golang.org/x/crypto',
      'github.com/stretchr/testify',
    ]);
    expect(deps.every((d) => d.ecosystem === 'gomod')).toBe(true);
  });

  it('dispatches to correct manifest parser via parseManifest', () => {
    const res = parseManifest('package.json', JSON.stringify({ dependencies: { zod: '^3.20.0' } }));
    expect(res).toHaveLength(1);
    expect(res[0]?.name).toBe('zod');
  });
});

describe('resolveModuleSpecifier', () => {
  const repoFiles = [
    'src/index.ts',
    'src/App.tsx',
    'src/components/Header.tsx',
    'src/components/Button.tsx',
    'src/components/index.ts',
    'src/utils/math.ts',
    'pkg/sub/a.py',
    'pkg/sub/b.py',
    'pkg/core.py',
  ];

  it('resolves relative imports with extension', () => {
    const res = resolveModuleSpecifier('./Header.tsx', 'src/components/Button.tsx', repoFiles);
    expect(res).toEqual({
      kind: 'internal',
      target: 'src/components/Header.tsx',
      rawSpecifier: './Header.tsx',
    });
  });

  it('resolves relative imports without extension', () => {
    const res = resolveModuleSpecifier('./Header', 'src/components/Button.tsx', repoFiles);
    expect(res).toEqual({
      kind: 'internal',
      target: 'src/components/Header.tsx',
      rawSpecifier: './Header',
    });
  });

  it('resolves directory index imports', () => {
    const res = resolveModuleSpecifier('./components', 'src/App.tsx', repoFiles);
    expect(res).toEqual({
      kind: 'internal',
      target: 'src/components/index.ts',
      rawSpecifier: './components',
    });
  });

  it('resolves @/ and ~/ path aliases', () => {
    const res = resolveModuleSpecifier('@/components/Header', 'src/App.tsx', repoFiles);
    expect(res).toEqual({
      kind: 'internal',
      target: 'src/components/Header.tsx',
      rawSpecifier: '@/components/Header',
    });
  });

  it('resolves Python relative imports', () => {
    const res = resolveModuleSpecifier('.b', 'pkg/sub/a.py', repoFiles);
    expect(res).toEqual({
      kind: 'internal',
      target: 'pkg/sub/b.py',
      rawSpecifier: '.b',
    });
  });

  it('classifies external npm/built-in packages as external', () => {
    const res = resolveModuleSpecifier('react', 'src/App.tsx', repoFiles);
    expect(res).toEqual({
      kind: 'external',
      target: 'react',
      rawSpecifier: 'react',
    });
  });

  it('handles scoped external packages', () => {
    const res = resolveModuleSpecifier('@astrojs/react', 'src/App.tsx', repoFiles);
    expect(res).toEqual({
      kind: 'external',
      target: '@astrojs/react',
      rawSpecifier: '@astrojs/react',
    });
  });
});

describe('detectCircularDependencies', () => {
  it('returns empty array when there are no cycles (DAG)', () => {
    const edges: DependencyEdge[] = [
      {
        id: '1',
        sourceFile: 'a.ts',
        target: 'b.ts',
        rawSpecifier: './b',
        kind: 'internal',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
      {
        id: '2',
        sourceFile: 'b.ts',
        target: 'c.ts',
        rawSpecifier: './c',
        kind: 'internal',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
    ];

    const cycles = detectCircularDependencies(edges);
    expect(cycles).toEqual([]);
  });

  it('detects a simple 2-node cycle (A -> B -> A)', () => {
    const edges: DependencyEdge[] = [
      {
        id: '1',
        sourceFile: 'a.ts',
        target: 'b.ts',
        rawSpecifier: './b',
        kind: 'internal',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
      {
        id: '2',
        sourceFile: 'b.ts',
        target: 'a.ts',
        rawSpecifier: './a',
        kind: 'internal',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
    ];

    const cycles = detectCircularDependencies(edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.files).toEqual(['a.ts', 'b.ts', 'a.ts']);
    expect(cycles[0]?.edgeIds).toEqual(['1', '2']);
  });

  it('detects a 3-node cycle (A -> B -> C -> A) and canonicalizes node order', () => {
    const edges: DependencyEdge[] = [
      {
        id: '1',
        sourceFile: 'a.ts',
        target: 'b.ts',
        rawSpecifier: './b',
        kind: 'internal',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
      {
        id: '2',
        sourceFile: 'b.ts',
        target: 'c.ts',
        rawSpecifier: './c',
        kind: 'internal',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
      {
        id: '3',
        sourceFile: 'c.ts',
        target: 'a.ts',
        rawSpecifier: './a',
        kind: 'internal',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
    ];

    const cycles = detectCircularDependencies(edges);
    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.files).toEqual(['a.ts', 'b.ts', 'c.ts', 'a.ts']);
    expect(cycles[0]?.edgeIds).toEqual(['1', '2', '3']);
  });

  it('does not count external dependencies in circular loops', () => {
    const edges: DependencyEdge[] = [
      {
        id: '1',
        sourceFile: 'a.ts',
        target: 'react',
        rawSpecifier: 'react',
        kind: 'external',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
      {
        id: '2',
        sourceFile: 'b.ts',
        target: 'react',
        rawSpecifier: 'react',
        kind: 'external',
        importedSymbols: [],
        isTypeOnly: false,
        isDynamic: false,
        line: 1,
      },
    ];

    const cycles = detectCircularDependencies(edges);
    expect(cycles).toHaveLength(0);
  });
});

describe('buildDependencyGraph', () => {
  it('builds complete dependency graph with files, manifests, degrees, cycles, and stats', () => {
    const parsedFiles = new Map([
      [
        'src/App.tsx',
        [
          { specifier: 'react', importedSymbols: [], isTypeOnly: false, isDynamic: false, line: 1 },
          {
            specifier: './Header',
            importedSymbols: [],
            isTypeOnly: false,
            isDynamic: false,
            line: 2,
          },
          {
            specifier: './Footer',
            importedSymbols: [],
            isTypeOnly: false,
            isDynamic: false,
            line: 3,
          },
        ],
      ],
      [
        'src/Header.tsx',
        [
          {
            specifier: './Icon',
            importedSymbols: [],
            isTypeOnly: false,
            isDynamic: false,
            line: 1,
          },
          { specifier: './App', importedSymbols: [], isTypeOnly: false, isDynamic: false, line: 2 }, // cycle with App
        ],
      ],
      [
        'src/Footer.tsx',
        [
          {
            specifier: './Icon',
            importedSymbols: [],
            isTypeOnly: false,
            isDynamic: false,
            line: 1,
          },
        ],
      ],
      ['src/Icon.tsx', []],
    ]);

    const allRepoPaths = new Set([
      'src/App.tsx',
      'src/Header.tsx',
      'src/Footer.tsx',
      'src/Icon.tsx',
      'package.json',
    ]);

    const manifests = parsePackageJson(
      JSON.stringify({ dependencies: { react: '^18.2.0', lucide: '^0.2.0' } }),
      'package.json'
    );

    const graph = buildDependencyGraph({
      parsedFiles,
      allRepoPaths,
      manifests,
    });

    // Nodes
    const fileNodes = Array.from(graph.nodes.values()).filter(
      (n): n is FileDependencyNode => n.type === 'file'
    );
    const packageNodes = Array.from(graph.nodes.values()).filter(
      (n): n is PackageDependencyNode => n.type === 'package'
    );

    expect(fileNodes.length).toBe(4);
    expect(packageNodes.length).toBeGreaterThanOrEqual(1);

    // Check App -> Header, Header -> App creates a cycle
    expect(graph.cycles.length).toBe(1);
    expect(graph.cycles[0]?.files).toEqual(['src/App.tsx', 'src/Header.tsx', 'src/App.tsx']);

    // Check inDegree and outDegree
    const appNode = fileNodes.find((f) => f.path === 'src/App.tsx');
    expect(appNode?.inDegree).toBeGreaterThanOrEqual(1);
    expect(appNode?.outDegree).toBeGreaterThanOrEqual(3);
    expect(appNode?.inCycle).toBe(true);

    const iconNode = fileNodes.find((f) => f.path === 'src/Icon.tsx');
    expect(iconNode?.inDegree).toBe(2);
    expect(iconNode?.inCycle).toBe(false);

    // Stats
    expect(graph.stats.analyzedFiles).toBe(4);
    expect(graph.stats.totalFiles).toBe(4);
    expect(graph.stats.circularCyclesCount).toBe(1);
  });
});

describe('Graph Filter and React Flow Adapter', () => {
  it('filters graph by query and mode', () => {
    const parsedFiles = new Map([
      [
        'src/main.ts',
        [
          {
            specifier: './helper',
            importedSymbols: [],
            isTypeOnly: false,
            isDynamic: false,
            line: 1,
          },
          { specifier: 'axios', importedSymbols: [], isTypeOnly: false, isDynamic: false, line: 2 },
        ],
      ],
      ['src/helper.ts', []],
    ]);
    const allRepoPaths = new Set(['src/main.ts', 'src/helper.ts', 'package.json']);
    const manifests = parsePackageJson(
      JSON.stringify({ dependencies: { axios: '^1.0.0' } }),
      'package.json'
    );

    const graph = buildDependencyGraph({ parsedFiles, allRepoPaths, manifests });

    // Filter: external mode
    const externalFiltered = filterDependencyGraph(graph, { filterMode: 'external' });
    const extPkgs = externalFiltered.visibleNodes.filter((n) => n.type === 'package');
    expect(extPkgs.length).toBeGreaterThanOrEqual(1);
    expect(Array.from(externalFiltered.matchingNodeIds).every((id) => id.startsWith('pkg:'))).toBe(
      true
    );
    expect(externalFiltered.totalMatches).toBe(extPkgs.length);

    // Filter: query
    const queryFiltered = filterDependencyGraph(graph, { searchQuery: 'helper' });
    const queryFiles = queryFiltered.visibleNodes.filter((n) => n.type === 'file');
    expect(queryFiles.some((f) => f.path.includes('helper'))).toBe(true);
  });

  it('transforms graph to React Flow elements with cycle highlights', () => {
    const parsedFiles = new Map([
      [
        'src/a.ts',
        [{ specifier: './b', importedSymbols: [], isTypeOnly: false, isDynamic: false, line: 1 }],
      ],
      [
        'src/b.ts',
        [{ specifier: './a', importedSymbols: [], isTypeOnly: false, isDynamic: false, line: 1 }],
      ],
    ]);
    const allRepoPaths = new Set(['src/a.ts', 'src/b.ts']);

    const graph = buildDependencyGraph({ parsedFiles, allRepoPaths });
    const nodes = Array.from(graph.nodes.values());
    const positions = computeDependencyLayout(nodes, graph.edges);

    const { nodes: flowNodes, edges: flowEdges } = serializeDependenciesToReactFlow(
      nodes,
      graph.edges,
      positions,
      {
        selectedNodeId: null,
        matchingNodeIds: new Set(nodes.map((n) => n.id)),
        cycles: graph.cycles,
      }
    );

    expect(flowNodes.length).toBe(2);
    expect(flowEdges.length).toBe(2);
    expect(flowEdges.every((e) => e.data?.isCycle === true)).toBe(true);
    expect(flowNodes.every((n) => (n.data?.node as FileDependencyNode)?.inCycle === true)).toBe(
      true
    );
  });
});
