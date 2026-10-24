import type { HealthRule, HealthRuleContext } from '../types';
import type { HealthFinding } from '@/types/health';
import { isSourceCodeFile, isGeneratedOrVendor } from '@/lib/metrics';

export const pathDepthRule: HealthRule = {
  id: 'maint-path-depth',
  name: 'Directory Hierarchy Depth',
  category: 'maintainability',
  maxPoints: 35,
  evaluate(context: HealthRuleContext): HealthFinding {
    let maxDepth = 0;
    let deepestPath = '';

    for (const entry of context.tree.entries) {
      const depth = entry.path.split('/').length;
      if (depth > maxDepth) {
        maxDepth = depth;
        deepestPath = entry.path;
      }
    }

    if (maxDepth <= 7) {
      return {
        id: 'maint-path-depth',
        ruleName: 'Directory Hierarchy Depth',
        kind: 'positive',
        pointsAwarded: 35,
        maxPoints: 35,
        summary: `Well-balanced directory depth (${maxDepth} levels)`,
        explanation:
          'Deeply nested hierarchies increase cognitive overhead and can hit OS path length limits.',
        evidence: `Max depth: ${maxDepth} levels (e.g. "${deepestPath}").`,
        applicable: true,
      };
    }

    if (maxDepth <= 10) {
      return {
        id: 'maint-path-depth',
        ruleName: 'Directory Hierarchy Depth',
        kind: 'neutral',
        pointsAwarded: 25,
        maxPoints: 35,
        summary: `Moderate directory depth (${maxDepth} levels)`,
        explanation: 'Nesting is slightly deep but manageable.',
        evidence: `Deepest path: "${deepestPath}".`,
        applicable: true,
      };
    }

    return {
      id: 'maint-path-depth',
      ruleName: 'Directory Hierarchy Depth',
      kind: 'negative',
      pointsAwarded: 15,
      maxPoints: 35,
      summary: `Excessive directory depth (${maxDepth} levels)`,
      explanation: 'Deep nesting (>10 levels) often indicates overly complex module packaging.',
      evidence: `Deepest path: "${deepestPath}".`,
      applicable: true,
    };
  },
};

export const monolithicFileRule: HealthRule = {
  id: 'maint-monolithic-files',
  name: 'Modular File Sizing',
  category: 'maintainability',
  maxPoints: 35,
  evaluate(context: HealthRuleContext): HealthFinding {
    // Look for largest non-vendor source file
    const candidateBlobs = context.tree.entries.filter(
      (e) =>
        e.type === 'blob' &&
        isSourceCodeFile(e.path) &&
        !isGeneratedOrVendor(e.path) &&
        typeof e.size === 'number'
    );

    if (candidateBlobs.length === 0) {
      return {
        id: 'maint-monolithic-files',
        ruleName: 'Modular File Sizing',
        kind: 'positive',
        pointsAwarded: 35,
        maxPoints: 35,
        summary: 'Source files within normal size limits',
        explanation: 'No oversized source files detected.',
        applicable: true,
      };
    }

    let largestBlob = candidateBlobs[0];
    for (const b of candidateBlobs) {
      if ((b.size || 0) > (largestBlob.size || 0)) {
        largestBlob = b;
      }
    }

    const largestKb = (largestBlob.size || 0) / 1024;

    // Below 150 KB for a source code file is healthy
    if (largestKb <= 150) {
      return {
        id: 'maint-monolithic-files',
        ruleName: 'Modular File Sizing',
        kind: 'positive',
        pointsAwarded: 35,
        maxPoints: 35,
        summary: 'Source modules are well partitioned',
        explanation:
          'Code is decomposed into reasonably sized modules rather than massive monoliths.',
        evidence: `Largest source file: "${largestBlob.path}" (${largestKb.toFixed(1)} KB).`,
        applicable: true,
      };
    }

    if (largestKb <= 500) {
      return {
        id: 'maint-monolithic-files',
        ruleName: 'Modular File Sizing',
        kind: 'neutral',
        pointsAwarded: 25,
        maxPoints: 35,
        summary: 'Moderate maximum file size',
        explanation: 'Largest source file is slightly large but acceptable for complex subsystems.',
        evidence: `"${largestBlob.path}" (${largestKb.toFixed(1)} KB).`,
        applicable: true,
      };
    }

    return {
      id: 'maint-monolithic-files',
      ruleName: 'Modular File Sizing',
      kind: 'negative',
      pointsAwarded: 15,
      maxPoints: 35,
      summary: 'Very large monolithic source file detected',
      explanation:
        'Files exceeding 500 KB of handwritten source code can hinder reviewability and maintainability.',
      evidence: `"${largestBlob.path}" (${largestKb.toFixed(1)} KB).`,
      applicable: true,
    };
  },
};

export const directoryStructureRule: HealthRule = {
  id: 'maint-structure-hygiene',
  name: 'Directory Organization & Layout',
  category: 'maintainability',
  maxPoints: 30,
  evaluate(context: HealthRuleContext): HealthFinding {
    const rootFiles = context.tree.entries.filter(
      (e) => e.type === 'blob' && !e.path.includes('/')
    );

    // If root file count is reasonable (<= 25 files at root including config files)
    if (rootFiles.length <= 25) {
      return {
        id: 'maint-structure-hygiene',
        ruleName: 'Directory Organization & Layout',
        kind: 'positive',
        pointsAwarded: 30,
        maxPoints: 30,
        summary: 'Root directory is clean and organized',
        explanation:
          'Source code is organized into subdirectories rather than clustered in the repository root.',
        evidence: `${rootFiles.length} files at root level.`,
        applicable: true,
      };
    }

    return {
      id: 'maint-structure-hygiene',
      ruleName: 'Directory Organization & Layout',
      kind: 'neutral',
      pointsAwarded: 20,
      maxPoints: 30,
      summary: 'High number of root-level files',
      explanation:
        'Consider grouping modules into structured directories (e.g. src/, lib/, docs/).',
      evidence: `${rootFiles.length} files at root level.`,
      applicable: true,
    };
  },
};

export const maintainabilityRules: readonly HealthRule[] = [
  pathDepthRule,
  monolithicFileRule,
  directoryStructureRule,
];
