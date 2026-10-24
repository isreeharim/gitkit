import { describe, it, expect } from 'vitest';
import { synthesizeArchitectureDiagram } from '@/lib/analyzer/architecture-synthesizer';
import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import type { PackageDependency } from '@/types/dependency';

describe('Architecture Synthesizer', () => {
  const mockMetadata: RepositoryMetadata = {
    owner: 'acme',
    name: 'ecommerce-app',
    fullName: 'acme/ecommerce-app',
    htmlUrl: 'https://github.com/acme/ecommerce-app',
    defaultBranch: 'main',
    visibility: 'public',
    isArchived: false,
    isFork: false,
    stars: 1250,
    forks: 340,
    watchers: 1250,
    openIssues: 12,
    sizeKb: 8500,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    pushedAt: '2024-01-03T00:00:00Z',
    language: 'TypeScript',
    license: { key: 'mit', name: 'MIT License', spdxId: 'MIT', url: null },
    description: 'An open-source ecommerce application',
    topics: ['ecommerce', 'typescript'],
    homepage: null,
  };

  const mockTree: RepositoryTree = {
    sha: 'tree123',
    totalFiles: 10,
    totalDirectories: 4,
    totalBytes: 54000,
    truncated: false,
    entries: [
      {
        path: 'src/pages/index.tsx',
        name: 'index.tsx',
        type: 'blob',
        mode: '100644',
        sha: 'a1',
        size: 1200,
      },
      {
        path: 'src/components/Cart.tsx',
        name: 'Cart.tsx',
        type: 'blob',
        mode: '100644',
        sha: 'a2',
        size: 2400,
      },
      {
        path: 'src/api/routes/checkout.ts',
        name: 'checkout.ts',
        type: 'blob',
        mode: '100644',
        sha: 'b1',
        size: 3100,
      },
      {
        path: 'src/api/server.ts',
        name: 'server.ts',
        type: 'blob',
        mode: '100644',
        sha: 'b2',
        size: 4500,
      },
      {
        path: 'src/services/payment-service.ts',
        name: 'payment-service.ts',
        type: 'blob',
        mode: '100644',
        sha: 'c1',
        size: 5000,
      },
      {
        path: 'src/services/order-engine.ts',
        name: 'order-engine.ts',
        type: 'blob',
        mode: '100644',
        sha: 'c2',
        size: 6200,
      },
      {
        path: 'src/db/schema.prisma',
        name: 'schema.prisma',
        type: 'blob',
        mode: '100644',
        sha: 'd1',
        size: 2800,
      },
      {
        path: 'src/db/client.ts',
        name: 'client.ts',
        type: 'blob',
        mode: '100644',
        sha: 'd2',
        size: 1500,
      },
      {
        path: 'src/workers/email-queue.ts',
        name: 'email-queue.ts',
        type: 'blob',
        mode: '100644',
        sha: 'e1',
        size: 1900,
      },
      {
        path: 'tests/cart.test.ts',
        name: 'cart.test.ts',
        type: 'blob',
        mode: '100644',
        sha: 't1',
        size: 800,
      },
    ],
  };

  const mockPackages: PackageDependency[] = [
    {
      name: 'prisma',
      versionConstraint: '^5.0.0',
      isDev: false,
      ecosystem: 'npm',
      manifestSource: 'package.json',
    },
    {
      name: 'stripe',
      versionConstraint: '^12.0.0',
      isDev: false,
      ecosystem: 'npm',
      manifestSource: 'package.json',
    },
    {
      name: 'vitest',
      versionConstraint: '^1.0.0',
      isDev: true,
      ecosystem: 'npm',
      manifestSource: 'package.json',
    },
  ];

  it('filters out test files and categorizes valid files into architectural subsystems', () => {
    const graph = synthesizeArchitectureDiagram({
      metadata: mockMetadata,
      tree: mockTree,
      packages: mockPackages,
    });

    // Tests should be excluded
    const hasTestNode = graph.nodes.some((n) => n.path && n.path.includes('tests/'));
    expect(hasTestNode).toBe(false);

    // Should create cohesive groups
    const groupIds = graph.groups.map((g) => g.id);
    expect(groupIds).toContain('client');
    expect(groupIds).toContain('routing');
    expect(groupIds).toContain('core');
    expect(groupIds).toContain('storage');
    expect(groupIds).toContain('worker');
    expect(groupIds).toContain('external');

    // Database node shapes
    const dbNode = graph.nodes.find((n) => n.groupId === 'storage');
    expect(dbNode?.shape).toBe('database');
    expect(dbNode?.tone).toBe('toneAmber');

    // Worker node shapes
    const workerNode = graph.nodes.find((n) => n.groupId === 'worker');
    expect(workerNode?.shape).toBe('queue');
    expect(workerNode?.tone).toBe('toneRose');

    // External dependencies (non-dev matching keywords like prisma and stripe)
    const extPrisma = graph.nodes.find((n) => n.label === 'prisma');
    const extStripe = graph.nodes.find((n) => n.label === 'stripe');
    expect(extPrisma).toBeDefined();
    expect(extStripe).toBeDefined();

    // Edges between subsystems
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.summary.totalComponents).toBe(graph.nodes.length);
    expect(graph.summary.subsystemsCount).toBe(graph.groups.length);
  });
});
