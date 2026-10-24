import { describe, it, expect } from 'vitest';
import { buildFileTreeHierarchy } from '@/lib/tree/tree-hierarchy';
import type { RepositoryTreeEntry } from '@/types/repository';

describe('buildFileTreeHierarchy', () => {
  it('constructs an empty tree for empty entries', () => {
    const result = buildFileTreeHierarchy([]);
    expect(result).toEqual([]);
  });

  it('builds a nested directory structure with folders first and computes file counts', () => {
    const entries: RepositoryTreeEntry[] = [
      {
        path: 'package.json',
        name: 'package.json',
        mode: '100644',
        type: 'blob',
        size: 500,
        sha: '1',
      },
      {
        path: 'src/components/Header.tsx',
        name: 'Header.tsx',
        mode: '100644',
        type: 'blob',
        size: 1200,
        sha: '2',
      },
      {
        path: 'src/components/Footer.tsx',
        name: 'Footer.tsx',
        mode: '100644',
        type: 'blob',
        size: 800,
        sha: '3',
      },
      { path: 'src/index.ts', name: 'index.ts', mode: '100644', type: 'blob', size: 300, sha: '4' },
      { path: 'README.md', name: 'README.md', mode: '100644', type: 'blob', size: 1500, sha: '5' },
    ];

    const tree = buildFileTreeHierarchy(entries);

    // Root should have 3 items: src (dir), package.json (file), README.md (file)
    // Directories first: src should be first!
    expect(tree[0].name).toBe('src');
    expect(tree[0].type).toBe('tree');
    expect(tree[0].fileCount).toBe(3); // Header, Footer, index.ts

    // Files sorted alphabetically
    expect(tree[1].name).toBe('package.json');
    expect(tree[2].name).toBe('README.md');

    // Inside src: components (dir), index.ts (file)
    const srcNode = tree[0];
    expect(srcNode.children[0].name).toBe('components');
    expect(srcNode.children[0].type).toBe('tree');
    expect(srcNode.children[0].fileCount).toBe(2);

    expect(srcNode.children[1].name).toBe('index.ts');
    expect(srcNode.children[1].type).toBe('blob');

    // Inside components: Footer.tsx, Header.tsx
    const componentsNode = srcNode.children[0];
    expect(componentsNode.children.map((c) => c.name)).toEqual(['Footer.tsx', 'Header.tsx']);
  });
});
