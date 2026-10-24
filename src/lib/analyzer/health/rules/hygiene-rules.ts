import type { HealthRule, HealthRuleContext } from '../types';
import type { HealthFinding } from '@/types/health';

export const gitignoreRule: HealthRule = {
  id: 'hygiene-gitignore',
  name: '.gitignore Configuration',
  category: 'hygiene',
  maxPoints: 35,
  evaluate(context: HealthRuleContext): HealthFinding {
    const gitignore = context.tree.entries.find((e) => e.name === '.gitignore');

    if (gitignore) {
      return {
        id: 'hygiene-gitignore',
        ruleName: '.gitignore Configuration',
        kind: 'positive',
        pointsAwarded: 35,
        maxPoints: 35,
        summary: '.gitignore is present',
        explanation:
          'Prevents unintentional commits of temporary artifacts, dependency caches, and local configurations.',
        evidence: `Found "${gitignore.path}".`,
        applicable: true,
      };
    }

    return {
      id: 'hygiene-gitignore',
      ruleName: '.gitignore Configuration',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 35,
      summary: 'Missing .gitignore file',
      explanation:
        'A .gitignore file prevents cluttering the repository with operating system and build artifacts.',
      applicable: true,
    };
  },
};

export const ciWorkflowsRule: HealthRule = {
  id: 'hygiene-ci',
  name: 'Continuous Integration (CI)',
  category: 'hygiene',
  maxPoints: 35,
  evaluate(context: HealthRuleContext): HealthFinding {
    const ciFiles = context.tree.entries.filter((e) =>
      /(^|\/)(\.github\/workflows\/|\.gitlab-ci\.yml|azure-pipelines\.ya?ml|\.circleci\/)/i.test(
        e.path
      )
    );

    if (ciFiles.length > 0) {
      return {
        id: 'hygiene-ci',
        ruleName: 'Continuous Integration (CI)',
        kind: 'positive',
        pointsAwarded: 35,
        maxPoints: 35,
        summary: `Automated CI configuration detected (${ciFiles.length} workflow ${ciFiles.length === 1 ? 'file' : 'files'})`,
        explanation:
          'Automated CI validates tests, linting, and builds across pull requests and commits.',
        evidence: `Workflows: ${ciFiles
          .slice(0, 2)
          .map((f) => `"${f.path}"`)
          .join(', ')}.`,
        applicable: true,
      };
    }

    return {
      id: 'hygiene-ci',
      ruleName: 'Continuous Integration (CI)',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 35,
      summary: 'No CI pipeline workflows detected',
      explanation:
        'Continuous integration (e.g. GitHub Actions) helps verify code quality deterministically.',
      applicable: true,
    };
  },
};

export const issueTemplatesRule: HealthRule = {
  id: 'hygiene-templates',
  name: 'Issue & PR Templates',
  category: 'hygiene',
  maxPoints: 15,
  evaluate(context: HealthRuleContext): HealthFinding {
    const templates = context.tree.entries.filter((e) =>
      /(^|\/)\.github\/(issue_template|pull_request_template)/i.test(e.path)
    );

    if (templates.length > 0) {
      return {
        id: 'hygiene-templates',
        ruleName: 'Issue & PR Templates',
        kind: 'positive',
        pointsAwarded: 15,
        maxPoints: 15,
        summary: 'Standard community templates detected',
        explanation: 'Guides bug reporters and PR contributors with structured checklists.',
        evidence: `Found ${templates.length} template ${templates.length === 1 ? 'file' : 'files'}.`,
        applicable: true,
      };
    }

    return {
      id: 'hygiene-templates',
      ruleName: 'Issue & PR Templates',
      kind: 'neutral',
      pointsAwarded: 0,
      maxPoints: 15,
      summary: 'No issue or PR templates detected',
      explanation:
        'Templates guide contributors to provide required reproduction steps and context.',
      applicable: true,
    };
  },
};

export const noBinaryBlobsRule: HealthRule = {
  id: 'hygiene-no-binary-blobs',
  name: 'No Committed Binary Artifacts',
  category: 'hygiene',
  maxPoints: 15,
  evaluate(context: HealthRuleContext): HealthFinding {
    const binaryExtensions = /\.(exe|dll|so|dylib|class|pyc|obj|o|bin)$/i;
    const badEntries = context.tree.entries.filter(
      (e) => e.type === 'blob' && binaryExtensions.test(e.name)
    );

    if (badEntries.length === 0) {
      return {
        id: 'hygiene-no-binary-blobs',
        ruleName: 'No Committed Binary Artifacts',
        kind: 'positive',
        pointsAwarded: 15,
        maxPoints: 15,
        summary: 'No compiled binary artifacts checked in',
        explanation:
          'Repository tree is clean of compiled machine binaries and temporary bytecode.',
        evidence: '0 compiled binaries found.',
        applicable: true,
      };
    }

    return {
      id: 'hygiene-no-binary-blobs',
      ruleName: 'No Committed Binary Artifacts',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 15,
      summary: `Found ${badEntries.length} compiled binary artifacts`,
      explanation:
        'Compiled artifacts increase repository size and should be excluded via .gitignore.',
      evidence: `Found: ${badEntries
        .slice(0, 3)
        .map((f) => `"${f.path}"`)
        .join(', ')}.`,
      applicable: true,
    };
  },
};

export const hygieneRules: readonly HealthRule[] = [
  gitignoreRule,
  ciWorkflowsRule,
  issueTemplatesRule,
  noBinaryBlobsRule,
];
