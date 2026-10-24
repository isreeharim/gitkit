import type { HealthRule, HealthRuleContext } from '../types';
import type { HealthFinding } from '@/types/health';

function isTestPath(path: string): boolean {
  return (
    /(^|\/)(tests?|__tests__|spec|specs)\//i.test(path) ||
    /\.(test|spec)\.[a-z0-9]+$/i.test(path) ||
    /_test\.(go|py|rs|rb)$/i.test(path) ||
    /test_[a-z0-9_]+\.py$/i.test(path)
  );
}

export const testSuitePresenceRule: HealthRule = {
  id: 'test-suite-presence',
  name: 'Automated Test Suite',
  category: 'testing',
  maxPoints: 40,
  evaluate(context: HealthRuleContext): HealthFinding {
    const testFiles = context.tree.entries.filter((e) => e.type === 'blob' && isTestPath(e.path));

    if (testFiles.length > 0) {
      return {
        id: 'test-suite-presence',
        ruleName: 'Automated Test Suite',
        kind: 'positive',
        pointsAwarded: 40,
        maxPoints: 40,
        summary: `Detected ${testFiles.length} automated test ${testFiles.length === 1 ? 'file' : 'files'}`,
        explanation: 'Automated tests provide regression protection and verify code correctness.',
        evidence: `Examples: ${testFiles
          .slice(0, 3)
          .map((f) => `"${f.path}"`)
          .join(', ')}${testFiles.length > 3 ? ` (+${testFiles.length - 3} more)` : ''}.`,
        applicable: true,
      };
    }

    return {
      id: 'test-suite-presence',
      ruleName: 'Automated Test Suite',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 40,
      summary: 'No test files detected in repository tree',
      explanation:
        'No files matching standard test conventions (e.g. tests/, *.test.*, *.spec.*) were found.',
      applicable: true,
    };
  },
};

export const testRunnerConfiguredRule: HealthRule = {
  id: 'test-runner-configured',
  name: 'Test Runner Configuration',
  category: 'testing',
  maxPoints: 35,
  evaluate(context: HealthRuleContext): HealthFinding {
    const runnerConfig = context.tree.entries.find((e) =>
      /(^|\/)(vitest\.config|jest\.config|pytest\.ini|setup\.cfg|\.rspec|playwright\.config|cypress\.config)(\.[a-z0-9]+)?$/i.test(
        e.path
      )
    );

    // Also check for Cargo.toml or go.mod
    const hasEcosystemRunner = context.tree.entries.some((e) =>
      /^(Cargo\.toml|go\.mod)$/i.test(e.name)
    );

    if (runnerConfig) {
      return {
        id: 'test-runner-configured',
        ruleName: 'Test Runner Configuration',
        kind: 'positive',
        pointsAwarded: 35,
        maxPoints: 35,
        summary: 'Dedicated test framework configuration detected',
        explanation:
          'Explicit test runner configuration standardizes test execution across local and CI environments.',
        evidence: `Found test config "${runnerConfig.path}".`,
        applicable: true,
      };
    }

    if (hasEcosystemRunner) {
      return {
        id: 'test-runner-configured',
        ruleName: 'Test Runner Configuration',
        kind: 'positive',
        pointsAwarded: 30,
        maxPoints: 35,
        summary: 'Standard ecosystem test harness detected',
        explanation:
          'Ecosystems like Go and Rust provide built-in standardized test harnesses (`go test`, `cargo test`).',
        evidence: 'Standard ecosystem tooling present.',
        applicable: true,
      };
    }

    return {
      id: 'test-runner-configured',
      ruleName: 'Test Runner Configuration',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 35,
      summary: 'No dedicated test configuration file detected',
      explanation:
        'Dedicated test configuration (e.g. vitest, jest, pytest, playwright) simplifies repeatable testing.',
      applicable: true,
    };
  },
};

export const testToCodeRatioRule: HealthRule = {
  id: 'test-to-code-ratio',
  name: 'Test File Coverage Ratio',
  category: 'testing',
  maxPoints: 25,
  evaluate(context: HealthRuleContext): HealthFinding {
    const totalBlobs = context.tree.entries.filter((e) => e.type === 'blob');
    if (totalBlobs.length <= 2) {
      // Very small repository or single file - don't penalize
      return {
        id: 'test-to-code-ratio',
        ruleName: 'Test File Coverage Ratio',
        kind: 'neutral',
        pointsAwarded: 25,
        maxPoints: 25,
        summary: 'Minimal repository size',
        explanation: 'Repository has fewer than 3 files; proportional ratio evaluation is waived.',
        applicable: false,
      };
    }

    const testFiles = totalBlobs.filter((e) => isTestPath(e.path));
    const ratio = totalBlobs.length > 0 ? testFiles.length / totalBlobs.length : 0;
    const percentage = Math.round(ratio * 100);

    if (percentage >= 10) {
      return {
        id: 'test-to-code-ratio',
        ruleName: 'Test File Coverage Ratio',
        kind: 'positive',
        pointsAwarded: 25,
        maxPoints: 25,
        summary: `Healthy test-to-file ratio (${percentage}%)`,
        explanation: 'Test files represent a significant portion of repository file count.',
        evidence: `${testFiles.length} test files out of ${totalBlobs.length} total files.`,
        applicable: true,
      };
    }

    if (testFiles.length > 0) {
      return {
        id: 'test-to-code-ratio',
        ruleName: 'Test File Coverage Ratio',
        kind: 'neutral',
        pointsAwarded: 15,
        maxPoints: 25,
        summary: `Moderate test-to-file ratio (${percentage}%)`,
        explanation: 'Tests are present but constitute less than 10% of total files.',
        evidence: `${testFiles.length} test files out of ${totalBlobs.length} total files.`,
        applicable: true,
      };
    }

    return {
      id: 'test-to-code-ratio',
      ruleName: 'Test File Coverage Ratio',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 25,
      summary: 'Zero test files relative to codebase size',
      explanation: 'No test files exist across the repository files.',
      applicable: true,
    };
  },
};

export const testingRules: readonly HealthRule[] = [
  testSuitePresenceRule,
  testRunnerConfiguredRule,
  testToCodeRatioRule,
];
