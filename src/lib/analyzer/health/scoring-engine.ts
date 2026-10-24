import type {
  HealthCategory,
  CategoryHealthScore,
  HealthRatingTier,
  RepositoryHealthReport,
} from '@/types/health';
import type { HealthRule, HealthRuleContext } from './types';
import { documentationRules } from './rules/documentation-rules';
import { testingRules } from './rules/testing-rules';
import { hygieneRules } from './rules/hygiene-rules';
import { dependencyRules } from './rules/dependency-rules';
import { maintainabilityRules } from './rules/maintainability-rules';
import { activityRules } from './rules/activity-rules';
import { securityRules } from './rules/security-rules';

export const HEALTH_CATEGORY_WEIGHTS: Record<HealthCategory, number> = {
  documentation: 0.2, // 20%
  testing: 0.2, // 20%
  hygiene: 0.15, // 15%
  dependencies: 0.15, // 15%
  maintainability: 0.1, // 10%
  activity: 0.1, // 10%
  security: 0.1, // 10%
};

export const HEALTH_CATEGORY_LABELS: Record<HealthCategory, string> = {
  documentation: 'Documentation & Licensing',
  testing: 'Automated Testing',
  hygiene: 'Repository Hygiene',
  dependencies: 'Dependency Architecture',
  maintainability: 'Maintainability & Structure',
  activity: 'Development Activity',
  security: 'Security Hygiene',
};

const CATEGORY_RULES_MAP: Record<HealthCategory, readonly HealthRule[]> = {
  documentation: documentationRules,
  testing: testingRules,
  hygiene: hygieneRules,
  dependencies: dependencyRules,
  maintainability: maintainabilityRules,
  activity: activityRules,
  security: securityRules,
};

/**
 * Deterministically evaluates a single health category.
 */
export function evaluateCategory(
  category: HealthCategory,
  context: HealthRuleContext
): CategoryHealthScore {
  const rules = CATEGORY_RULES_MAP[category] || [];
  const findings = rules.map((r) => r.evaluate(context));

  let scoreSum = 0;
  let maxScoreSum = 0;

  for (const f of findings) {
    scoreSum += f.pointsAwarded;
    maxScoreSum += f.maxPoints;
  }

  const percentage = maxScoreSum > 0 ? Math.round((scoreSum / maxScoreSum) * 100) : 0;

  return {
    category,
    label: HEALTH_CATEGORY_LABELS[category],
    score: scoreSum,
    maxScore: maxScoreSum,
    percentage,
    positiveFindings: findings.filter((f) => f.kind === 'positive'),
    negativeFindings: findings.filter((f) => f.kind === 'negative'),
    neutralFindings: findings.filter((f) => f.kind === 'neutral'),
  };
}

/**
 * Classifies an overall 0-100 score into a standard GitKit Health tier.
 */
export function getHealthRatingTier(score: number): { tier: HealthRatingTier; label: string } {
  if (score >= 85) {
    return { tier: 'exemplary', label: 'Exemplary Health' };
  }
  if (score >= 70) {
    return { tier: 'healthy', label: 'Healthy Repository' };
  }
  if (score >= 50) {
    return { tier: 'moderate', label: 'Moderate Health' };
  }
  return { tier: 'needs_attention', label: 'Needs Attention' };
}

/**
 * Deterministically evaluates all rules and compiles the complete RepositoryHealthReport.
 */
export function evaluateRepositoryHealth(context: HealthRuleContext): RepositoryHealthReport {
  const categoriesList: HealthCategory[] = [
    'documentation',
    'testing',
    'hygiene',
    'dependencies',
    'maintainability',
    'activity',
    'security',
  ];

  const categoryScores = categoriesList.map((cat) => evaluateCategory(cat, context));

  // Compute weighted overall score
  let weightedSum = 0;
  let totalPositive = 0;
  let totalNegative = 0;

  for (const cs of categoryScores) {
    const weight = HEALTH_CATEGORY_WEIGHTS[cs.category] ?? 0;
    weightedSum += cs.percentage * weight;
    totalPositive += cs.positiveFindings.length;
    totalNegative += cs.negativeFindings.length;
  }

  const overallScore = Math.min(100, Math.max(0, Math.round(weightedSum)));
  const { tier, label } = getHealthRatingTier(overallScore);

  return {
    repoId: `${context.metadata.owner}/${context.metadata.name}`,
    generatedAt: new Date().toISOString(),
    overallScore,
    ratingTier: tier,
    ratingLabel: label,
    categories: categoryScores,
    totalPositiveFindings: totalPositive,
    totalNegativeFindings: totalNegative,
    methodology: {
      version: '1.0.0',
      description:
        'GitKit Health is a 100% deterministic, rule-based assessment evaluating documentation, testing, hygiene, dependencies, structure, activity, and security hygiene without AI or statistical guesswork.',
      formula:
        'Overall Score = round( sum( CategoryPercentage * CategoryWeight ) ) across all 7 categories (weights: Docs 20%, Tests 20%, Hygiene 15%, Dependencies 15%, Maintainability 10%, Activity 10%, Security 10%).',
      categoryWeights: HEALTH_CATEGORY_WEIGHTS,
    },
  };
}
