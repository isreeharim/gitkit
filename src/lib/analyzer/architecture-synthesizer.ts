import type { RepositoryMetadata, RepositoryTree, RepositoryTreeEntry } from '@/types/repository';
import type { PackageDependency } from '@/types/dependency';
import type {
  DiagramGraph,
  DiagramGroup,
  DiagramNode,
  DiagramEdge,
  DiagramNodeShape,
  DiagramTone,
} from '@/types/diagram';

const EXCLUDED =
  /(^|\/)(?:\.[^/]+|tests?|__tests__|__mocks__|mocks?|testdata|fixtures?|e2e|cypress|examples?(?:_src)?|samples?|demos?|stories|storybook|docs?(?:_src)?|tutorials?(?:_src)?|documentation|bench|benchmarks?|vendor|third_party|node_modules|dist|build|generated|migrations?|alembic|assets|locales?|translations?)(\/|$)|(?:\.test(?:-d)?|\.spec|\.generated|\.min|\.stories|\.designer)\.|(?:_pb2(?:_grpc)?\.py|\.pb(?:\.gw)?\.go|\.g\.cs)$/i;

const SOURCE_EXTENSIONS =
  /\.(?:[cm]?[jt]sx?|py|go|rs|java|kt|kts|swift|cs|cpp|cc|c|h|hpp|rb|php|ex|exs|scala|clj|vue|svelte|proto|graphql)$/i;

interface ScoredFile {
  entry: RepositoryTreeEntry;
  score: number;
  subsystem: 'client' | 'routing' | 'core' | 'storage' | 'worker' | 'unknown';
  role: string;
}

function classifySubsystem(path: string): {
  subsystem: 'client' | 'routing' | 'core' | 'storage' | 'worker' | 'unknown';
  role: string;
} {
  const lower = path.toLowerCase();
  const name = path.split('/').pop() || path;

  // Storage / State
  if (
    /(?:db|database|storage|cache|redis|postgres|sqlite|mongo|prisma|schema|model|entity|repository|dao)/i.test(
      lower
    )
  ) {
    return { subsystem: 'storage', role: 'Data Store / Model' };
  }

  // Background / Async / Workers
  if (
    /(?:worker|queue|cron|job|task|scheduler|consumer|background|dispatch|event-handler)/i.test(
      lower
    )
  ) {
    return { subsystem: 'worker', role: 'Worker / Queue' };
  }

  // Routing / API / Controllers
  if (/(?:route|api|controller|endpoint|handler|webhook|server\b|gateway|router)/i.test(lower)) {
    return { subsystem: 'routing', role: 'API / Route' };
  }

  // Client / UI / Screens
  if (
    /(?:components?|views?|pages?|screens?|ui|styles|frontend|layouts?|public|hooks)/i.test(
      lower
    ) ||
    /\.(?:jsx|tsx|vue|svelte|astro|html|css)$/i.test(name)
  ) {
    return { subsystem: 'client', role: 'UI / Component' };
  }

  // Core domain logic
  if (
    /(?:service|engine|analyzer|parser|manager|processor|pipeline|core|lib|domain|generator)/i.test(
      lower
    )
  ) {
    return { subsystem: 'core', role: 'Domain Engine' };
  }

  return { subsystem: 'unknown', role: 'Module' };
}

function scoreFile(path: string): number {
  const name = path.split('/').pop() || path;
  let s = 20 - path.split('/').length;

  if (/^(?:main|app|server|index|Program|lib|mod)\./i.test(name)) s += 30;
  if (/^(?:route|\+server|handler)\./i.test(name)) s += 25;
  if (/(?:service|engine|controller|manager|analyzer|storage|client)/i.test(name)) s += 15;
  if (/(?:types|constants|utils|helpers)\./i.test(name)) s -= 5;

  return s;
}

function formatNodeLabel(path: string): string {
  const parts = path.split('/');
  const fileName = parts.pop() || path;
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');

  if (parts.length > 0) {
    const parentDir = parts[parts.length - 1];
    if (parentDir && !['src', 'lib', 'app'].includes(parentDir)) {
      return `${parentDir}/${nameWithoutExt}`;
    }
  }

  return nameWithoutExt;
}

export interface ArchitectureSynthesizerInput {
  metadata: RepositoryMetadata;
  tree: RepositoryTree;
  packages?: PackageDependency[];
}

/**
 * 100% Deterministically synthesizes an architectural DiagramGraph from repository tree,
 * file scoring, and manifest dependencies.
 */
export function synthesizeArchitectureDiagram(input: ArchitectureSynthesizerInput): DiagramGraph {
  const { metadata, tree, packages = [] } = input;

  const validFiles: ScoredFile[] = [];

  for (const entry of tree.entries) {
    if (entry.type !== 'blob' || !entry.path) continue;
    if (EXCLUDED.test(entry.path)) continue;
    if (!SOURCE_EXTENSIONS.test(entry.path)) continue;

    const classification = classifySubsystem(entry.path);
    const score = scoreFile(entry.path);

    validFiles.push({
      entry,
      score,
      subsystem: classification.subsystem === 'unknown' ? 'core' : classification.subsystem,
      role: classification.role,
    });
  }

  // Sort candidate files by score descending
  validFiles.sort((a, b) => b.score - a.score);

  // Group candidate files by subsystem to ensure balanced representation
  const filesBySubsystem = new Map<string, ScoredFile[]>();
  for (const f of validFiles) {
    const list = filesBySubsystem.get(f.subsystem) || [];
    list.push(f);
    filesBySubsystem.set(f.subsystem, list);
  }

  // Select top components per subsystem
  const selectedNodes: DiagramNode[] = [];
  const groups: DiagramGroup[] = [];
  const selectedNodeMap = new Map<string, DiagramNode>();

  const subsystemConfig: Array<{
    id: string;
    label: string;
    maxNodes: number;
    shape: DiagramNodeShape;
    tone: DiagramTone;
  }> = [
    { id: 'client', label: 'Client & UI Layer', maxNodes: 4, shape: 'box', tone: 'toneBlue' },
    { id: 'routing', label: 'API & Routing Layer', maxNodes: 4, shape: 'box', tone: 'toneMint' },
    { id: 'core', label: 'Core Services & Engines', maxNodes: 6, shape: 'box', tone: 'toneIndigo' },
    {
      id: 'storage',
      label: 'Data & Persistence',
      maxNodes: 4,
      shape: 'database',
      tone: 'toneAmber',
    },
    { id: 'worker', label: 'Background & Queues', maxNodes: 3, shape: 'queue', tone: 'toneRose' },
  ];

  for (const config of subsystemConfig) {
    const candidateFiles = filesBySubsystem.get(config.id) || [];
    const topFiles = candidateFiles.slice(0, config.maxNodes);

    if (topFiles.length > 0) {
      groups.push({
        id: config.id,
        label: config.label,
        description: null,
      });

      for (const item of topFiles) {
        const nodeId = `node_${item.entry.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const node: DiagramNode = {
          id: nodeId,
          label: formatNodeLabel(item.entry.path),
          type: item.role,
          description: item.entry.path,
          groupId: config.id,
          path: item.entry.path,
          shape: config.shape,
          tone: config.tone,
        };
        selectedNodes.push(node);
        selectedNodeMap.set(nodeId, node);
      }
    }
  }

  // Add prominent external packages if detected
  const keyExternalKeywords = [
    'react',
    'next',
    'astro',
    'vue',
    'svelte',
    'express',
    'fastify',
    'hono',
    'koa',
    'flask',
    'django',
    'fastapi',
    'postgres',
    'mysql',
    'sqlite',
    'mongodb',
    'redis',
    'prisma',
    'drizzle',
    'tailwindcss',
    'octokit',
    'cloudflare',
    'stripe',
    'vitest',
    'jest',
  ];

  const prominentPackages = packages
    .filter((pkg) => !pkg.isDev)
    .filter((pkg) => keyExternalKeywords.some((kw) => pkg.name.toLowerCase().includes(kw)))
    .slice(0, 3);

  if (prominentPackages.length > 0) {
    groups.push({
      id: 'external',
      label: 'External Integrations',
      description: null,
    });

    for (const pkg of prominentPackages) {
      const extNodeId = `node_ext_${pkg.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const extNode: DiagramNode = {
        id: extNodeId,
        label: pkg.name,
        type: `Package (${pkg.ecosystem})`,
        description: pkg.versionConstraint || 'External Dependency',
        groupId: 'external',
        path: pkg.manifestSource || null,
        shape: 'circle',
        tone: 'toneTeal',
      };
      selectedNodes.push(extNode);
      selectedNodeMap.set(extNodeId, extNode);
    }
  }

  // Synthesize deterministic edges across subsystems
  const edges: DiagramEdge[] = [];
  let edgeId = 1;

  const clientNodes = selectedNodes.filter((n) => n.groupId === 'client');
  const routingNodes = selectedNodes.filter((n) => n.groupId === 'routing');
  const coreNodes = selectedNodes.filter((n) => n.groupId === 'core');
  const storageNodes = selectedNodes.filter((n) => n.groupId === 'storage');
  const workerNodes = selectedNodes.filter((n) => n.groupId === 'worker');
  const externalNodes = selectedNodes.filter((n) => n.groupId === 'external');

  // Client -> Routing
  if (clientNodes.length > 0 && routingNodes.length > 0) {
    for (let i = 0; i < Math.min(clientNodes.length, routingNodes.length); i++) {
      edges.push({
        id: `e_${edgeId++}`,
        from: clientNodes[i].id,
        to: routingNodes[i].id,
        label: 'HTTP / API',
        style: 'solid',
      });
    }
  } else if (clientNodes.length > 0 && coreNodes.length > 0) {
    // If no explicit routing layer, Client -> Core
    edges.push({
      id: `e_${edgeId++}`,
      from: clientNodes[0].id,
      to: coreNodes[0].id,
      label: 'invokes',
      style: 'solid',
    });
  }

  // Routing -> Core
  if (routingNodes.length > 0 && coreNodes.length > 0) {
    for (let i = 0; i < Math.min(routingNodes.length, coreNodes.length); i++) {
      edges.push({
        id: `e_${edgeId++}`,
        from: routingNodes[i].id,
        to: coreNodes[i].id,
        label: 'delegates to',
        style: 'solid',
      });
    }
  }

  // Core -> Storage
  if (coreNodes.length > 0 && storageNodes.length > 0) {
    for (let i = 0; i < Math.min(coreNodes.length, storageNodes.length); i++) {
      edges.push({
        id: `e_${edgeId++}`,
        from: coreNodes[i].id,
        to: storageNodes[i].id,
        label: 'queries / persists',
        style: 'solid',
      });
    }
  }

  // Core -> Worker
  if (coreNodes.length > 0 && workerNodes.length > 0) {
    for (let i = 0; i < Math.min(coreNodes.length, workerNodes.length); i++) {
      edges.push({
        id: `e_${edgeId++}`,
        from: coreNodes[i].id,
        to: workerNodes[i].id,
        label: 'enqueues / tasks',
        style: 'dashed',
      });
    }
  }

  // Core / Routing -> External
  if (externalNodes.length > 0) {
    const targetCaller = coreNodes[0] || routingNodes[0] || clientNodes[0];
    if (targetCaller) {
      for (const ext of externalNodes) {
        edges.push({
          id: `e_${edgeId++}`,
          from: targetCaller.id,
          to: ext.id,
          label: 'uses',
          style: 'dashed',
        });
      }
    }
  }

  return {
    groups,
    nodes: selectedNodes,
    edges,
    summary: {
      totalComponents: selectedNodes.length,
      subsystemsCount: groups.length,
      relationshipsCount: edges.length,
      primaryLanguage: metadata.language || undefined,
    },
  };
}
