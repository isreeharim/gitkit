import type { RepositoryMetadata } from './repository';
import type { RepositoryMetricsReport } from './metrics';
import type { DependencyGraph } from './dependency';
import type { RepositoryHealthReport } from './health';
import type { SecurityReport } from './security';
import type { RepoGraph } from '@/lib/graph/graph-model';

/**
 * Supported export file formats.
 */
export type ExportFormat = 'svg' | 'png' | 'mermaid' | 'json';

/**
 * Supported target analysis datasets for export.
 */
export type ExportTarget =
  'repomap' | 'dependencies' | 'metrics' | 'health' | 'security' | 'bundle';

/**
 * Versioned GitKit JSON Export Schema (v1.0).
 */
export interface GitKitExportPayload {
  readonly version: '1.0';
  readonly schema: 'https://gitkit.in/schemas/v1.0/export.json';
  readonly exportedAt: string; // ISO 8601
  readonly generator: 'GitKit 0.1.0';
  readonly repository: {
    readonly owner: string;
    readonly name: string;
    readonly fullName: string;
    readonly url: string;
    readonly defaultBranch: string;
    readonly description: string | null;
    readonly license: string | null;
    readonly stars: number;
    readonly forks: number;
    readonly watchers: number;
    readonly openIssues: number;
    readonly sizeKb: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly pushedAt: string;
  };
  readonly metrics?: {
    readonly totalFiles: number;
    readonly totalDirectories: number;
    readonly totalBytes: number;
    readonly loc?: {
      readonly totalLines: number;
      readonly codeLines: number;
      readonly commentLines: number;
      readonly blankLines: number;
    };
    readonly languageDistribution: Record<string, number>;
  };
  readonly repoMap?: {
    readonly rootId: string;
    readonly totalNodes: number;
    readonly totalEdges: number;
    readonly nodes: Array<{
      readonly id: string;
      readonly label: string;
      readonly type: 'repository' | 'directory' | 'file';
      readonly path: string;
      readonly extension?: string;
      readonly size?: number;
      readonly childCount?: number;
    }>;
    readonly edges: Array<{
      readonly id: string;
      readonly source: string;
      readonly target: string;
    }>;
  };
  readonly dependencies?: {
    readonly internalModulesCount: number;
    readonly externalPackagesCount: number;
    readonly totalEdges: number;
    readonly hasCycles: boolean;
    readonly cycles: Array<string[]>;
    readonly nodes: Array<{
      readonly id: string;
      readonly name: string;
      readonly type: 'internal' | 'external';
      readonly inDegree: number;
      readonly outDegree: number;
      readonly inCycle: boolean;
    }>;
    readonly edges: Array<{
      readonly id: string;
      readonly source: string;
      readonly target: string;
      readonly kind: 'internal' | 'external' | 'unresolved';
    }>;
  };
  readonly health?: {
    readonly overallScore: number;
    readonly ratingTier: string;
    readonly categories: Array<{
      readonly id: string;
      readonly name: string;
      readonly score: number;
      readonly maxScore: number;
      readonly percentage: number;
    }>;
  };
  readonly security?: {
    readonly summary: {
      readonly totalFindings: number;
      readonly bySeverity: Record<string, number>;
      readonly byType: Record<string, number>;
    };
    readonly findingsCount: number;
    readonly findings: Array<{
      readonly id: string;
      readonly type: string;
      readonly severity: string;
      readonly ruleId: string;
      readonly file: string;
      readonly message: string;
      readonly confidence: string;
    }>;
  };
}

/**
 * Input bundle for compiling a GitKit export payload.
 */
export interface GitKitExportInput {
  readonly metadata: RepositoryMetadata;
  readonly repoGraph?: RepoGraph;
  readonly dependencyGraph?: DependencyGraph;
  readonly metricsReport?: RepositoryMetricsReport;
  readonly healthReport?: RepositoryHealthReport;
  readonly securityReport?: SecurityReport;
  readonly exportedAt?: string;
}
