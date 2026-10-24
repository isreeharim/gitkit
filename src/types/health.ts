/**
 * Health assessment categories.
 */
export type HealthCategory =
  | 'documentation'
  | 'testing'
  | 'hygiene'
  | 'dependencies'
  | 'maintainability'
  | 'activity'
  | 'security';

/**
 * Finding polarity: positive (reward points), negative (penalty or deduction), or neutral (info only).
 */
export type HealthFindingKind = 'positive' | 'negative' | 'neutral';

/**
 * Individual rule assessment finding.
 */
export interface HealthFinding {
  readonly id: string;
  readonly ruleName: string;
  readonly kind: HealthFindingKind;
  readonly pointsAwarded: number;
  readonly maxPoints: number;
  readonly summary: string;
  readonly explanation: string;
  readonly evidence?: string;
  readonly applicable: boolean;
}

/**
 * Aggregated score for an individual health category.
 */
export interface CategoryHealthScore {
  readonly category: HealthCategory;
  readonly label: string;
  readonly score: number;
  readonly maxScore: number;
  readonly percentage: number; // 0 - 100
  readonly positiveFindings: readonly HealthFinding[];
  readonly negativeFindings: readonly HealthFinding[];
  readonly neutralFindings: readonly HealthFinding[];
}

/**
 * High-level health tier rating.
 */
export type HealthRatingTier = 'exemplary' | 'healthy' | 'moderate' | 'needs_attention';

export interface HealthMethodology {
  readonly version: string;
  readonly description: string;
  readonly formula: string;
  readonly categoryWeights: Record<HealthCategory, number>;
}

/**
 * Overall Repository Health Report.
 */
export interface RepositoryHealthReport {
  readonly repoId: string;
  readonly generatedAt: string;
  readonly overallScore: number; // 0 - 100
  readonly ratingTier: HealthRatingTier;
  readonly ratingLabel: string;
  readonly categories: readonly CategoryHealthScore[];
  readonly totalPositiveFindings: number;
  readonly totalNegativeFindings: number;
  readonly methodology: HealthMethodology;
}
