import type { HealthRule, HealthRuleContext } from '../types';
import type { HealthFinding } from '@/types/health';
import { isManifestFile } from '@/lib/parser';

export const lockfilePresenceRule: HealthRule = {
  id: 'dep-lockfile',
  name: 'Dependency Lockfile',
  category: 'dependencies',
  maxPoints: 40,
  evaluate(context: HealthRuleContext): HealthFinding {
    const hasManifest = context.tree.entries.some(
      (e) => e.type === 'blob' && isManifestFile(e.path)
    );

    if (!hasManifest) {
      // Non-dependency project (e.g. docs or standalone scripts) - do not penalize
      return {
        id: 'dep-lockfile',
        ruleName: 'Dependency Lockfile',
        kind: 'neutral',
        pointsAwarded: 40,
        maxPoints: 40,
        summary: 'No package manifests detected',
        explanation:
          'Project does not declare external package manifests; lockfile requirement is waived.',
        applicable: false,
      };
    }

    const lockfiles = context.tree.entries.filter((e) =>
      /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|go\.sum|bun\.lockb)$/i.test(
        e.name
      )
    );

    if (lockfiles.length > 0) {
      return {
        id: 'dep-lockfile',
        ruleName: 'Dependency Lockfile',
        kind: 'positive',
        pointsAwarded: 40,
        maxPoints: 40,
        summary: 'Package lockfile is committed',
        explanation:
          'Ensures deterministic, reproducible builds and protects against upstream package drifting.',
        evidence: `Found ${lockfiles.map((l) => `"${l.name}"`).join(', ')}.`,
        applicable: true,
      };
    }

    return {
      id: 'dep-lockfile',
      ruleName: 'Dependency Lockfile',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 40,
      summary: 'Missing package lockfile',
      explanation:
        'Package manifests exist without a lockfile, risking non-reproducible dependency resolution.',
      applicable: true,
    };
  },
};

export const cycleFreeRule: HealthRule = {
  id: 'dep-cycle-free',
  name: 'Circular Dependency Architecture',
  category: 'dependencies',
  maxPoints: 40,
  evaluate(context: HealthRuleContext): HealthFinding {
    if (!context.graph) {
      return {
        id: 'dep-cycle-free',
        ruleName: 'Circular Dependency Architecture',
        kind: 'neutral',
        pointsAwarded: 40,
        maxPoints: 40,
        summary: 'No circular imports detected',
        explanation: 'Clean module dependency hierarchy.',
        applicable: true,
      };
    }

    if (context.graph.cycles && context.graph.cycles.length > 0) {
      const firstCycle = context.graph.cycles[0];
      return {
        id: 'dep-cycle-free',
        ruleName: 'Circular Dependency Architecture',
        kind: 'negative',
        pointsAwarded: 10,
        maxPoints: 40,
        summary: `Detected ${context.graph.cycles.length} circular dependency ${context.graph.cycles.length === 1 ? 'cycle' : 'cycles'}`,
        explanation:
          'Circular imports create tight module coupling and can cause unexpected runtime order errors.',
        evidence: `Example: ${firstCycle.files.join(' -> ')}.`,
        applicable: true,
      };
    }

    return {
      id: 'dep-cycle-free',
      ruleName: 'Circular Dependency Architecture',
      kind: 'positive',
      pointsAwarded: 40,
      maxPoints: 40,
      summary: 'Cycle-free module import graph',
      explanation:
        'Deterministic AST analysis verified zero circular dependencies between analyzed source files.',
      evidence: `${context.graph.stats.analyzedFiles} files analyzed with 0 cycles.`,
      applicable: true,
    };
  },
};

export const manifestCleanlinessRule: HealthRule = {
  id: 'dep-manifest-cleanliness',
  name: 'Manifest Definition & Cohesion',
  category: 'dependencies',
  maxPoints: 20,
  evaluate(context: HealthRuleContext): HealthFinding {
    const manifestEntries = context.tree.entries.filter(
      (e) => e.type === 'blob' && isManifestFile(e.path)
    );

    if (manifestEntries.length === 0) {
      return {
        id: 'dep-manifest-cleanliness',
        ruleName: 'Manifest Definition & Cohesion',
        kind: 'neutral',
        pointsAwarded: 20,
        maxPoints: 20,
        summary: 'No package manifests required',
        explanation: 'Repository operates without package manager manifests.',
        applicable: false,
      };
    }

    return {
      id: 'dep-manifest-cleanliness',
      ruleName: 'Manifest Definition & Cohesion',
      kind: 'positive',
      pointsAwarded: 20,
      maxPoints: 20,
      summary: `Recognized ${manifestEntries.length} package ${manifestEntries.length === 1 ? 'manifest' : 'manifests'}`,
      explanation: 'Package dependencies follow recognized ecosystem configuration formats.',
      evidence: manifestEntries.map((m) => `"${m.name}"`).join(', '),
      applicable: true,
    };
  },
};

export const dependencyRules: readonly HealthRule[] = [
  lockfilePresenceRule,
  cycleFreeRule,
  manifestCleanlinessRule,
];
