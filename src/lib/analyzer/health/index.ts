export type {
  HealthCategory,
  HealthFindingKind,
  HealthFinding,
  CategoryHealthScore,
  HealthRatingTier,
  HealthMethodology,
  RepositoryHealthReport,
} from '@/types/health';

export type { HealthRule, HealthRuleContext } from './types';

export {
  HEALTH_CATEGORY_WEIGHTS,
  HEALTH_CATEGORY_LABELS,
  evaluateCategory,
  getHealthRatingTier,
  evaluateRepositoryHealth,
} from './scoring-engine';

export { documentationRules } from './rules/documentation-rules';
export { testingRules } from './rules/testing-rules';
export { hygieneRules } from './rules/hygiene-rules';
export { dependencyRules } from './rules/dependency-rules';
export { maintainabilityRules } from './rules/maintainability-rules';
export { activityRules } from './rules/activity-rules';
export { securityRules } from './rules/security-rules';
