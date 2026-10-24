import type { HealthCategory, HealthFinding } from '@/types/health';
import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import type { DependencyGraph } from '@/types/dependency';
import type { RepositoryMetricsReport } from '@/types/metrics';
import type { GitCommit } from '@/types/git';

/**
 * Context provided to each deterministic health rule for evaluation.
 */
export interface HealthRuleContext {
  readonly metadata: RepositoryMetadata;
  readonly tree: RepositoryTree;
  readonly graph?: DependencyGraph;
  readonly metrics?: RepositoryMetricsReport;
  readonly commits?: GitCommit[];
}

/**
 * Modular health rule interface.
 */
export interface HealthRule {
  readonly id: string;
  readonly name: string;
  readonly category: HealthCategory;
  readonly maxPoints: number;
  /**
   * Deterministically evaluates the repository context against this rule.
   */
  evaluate(context: HealthRuleContext): HealthFinding;
}
