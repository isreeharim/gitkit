import type { HealthRule, HealthRuleContext } from '../types';
import type { HealthFinding } from '@/types/health';

export const readmeRule: HealthRule = {
  id: 'doc-readme',
  name: 'README Documentation',
  category: 'documentation',
  maxPoints: 25,
  evaluate(context: HealthRuleContext): HealthFinding {
    const readmeEntry = context.tree.entries.find((e) => /^readme(\.[a-z0-9]+)?$/i.test(e.name));

    if (readmeEntry) {
      return {
        id: 'doc-readme',
        ruleName: 'README Documentation',
        kind: 'positive',
        pointsAwarded: 25,
        maxPoints: 25,
        summary: 'README file is present',
        explanation:
          'The repository provides an entrypoint README file explaining project overview and usage.',
        evidence: `Found "${readmeEntry.path}" (${readmeEntry.size ? (readmeEntry.size / 1024).toFixed(1) + ' KB' : 'present'}).`,
        applicable: true,
      };
    }

    return {
      id: 'doc-readme',
      ruleName: 'README Documentation',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 25,
      summary: 'No README file detected',
      explanation:
        'Repositories benefit from a README to help developers understand purpose, setup, and navigation.',
      applicable: true,
    };
  },
};

export const licenseRule: HealthRule = {
  id: 'doc-license',
  name: 'Open Source License',
  category: 'documentation',
  maxPoints: 25,
  evaluate(context: HealthRuleContext): HealthFinding {
    const hasLicenseMetadata = context.metadata.license && context.metadata.license.key !== 'other';
    const licenseFile = context.tree.entries.find((e) =>
      /^(license|licence|copying)(\.[a-z0-9]+)?$/i.test(e.name)
    );

    if (hasLicenseMetadata || licenseFile) {
      const licenseName = context.metadata.license?.name || licenseFile?.name || 'Detected';
      return {
        id: 'doc-license',
        ruleName: 'Open Source License',
        kind: 'positive',
        pointsAwarded: 25,
        maxPoints: 25,
        summary: 'License detected',
        explanation:
          'An open-source license establishes legal terms for distribution, modification, and contribution.',
        evidence: `License: ${licenseName}${licenseFile ? ` (file: ${licenseFile.path})` : ''}.`,
        applicable: true,
      };
    }

    return {
      id: 'doc-license',
      ruleName: 'Open Source License',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 25,
      summary: 'No license file or metadata found',
      explanation:
        'Without a license, public code defaults to exclusive copyright, preventing others from legally adopting it.',
      applicable: true,
    };
  },
};

export const descriptionRule: HealthRule = {
  id: 'doc-description',
  name: 'Repository Description',
  category: 'documentation',
  maxPoints: 15,
  evaluate(context: HealthRuleContext): HealthFinding {
    const desc = context.metadata.description?.trim();
    if (desc && desc.length > 5) {
      return {
        id: 'doc-description',
        ruleName: 'Repository Description',
        kind: 'positive',
        pointsAwarded: 15,
        maxPoints: 15,
        summary: 'Repository description provided',
        explanation: 'Clear metadata helps users quickly understand the scope of the project.',
        evidence: `"${desc.length > 60 ? desc.slice(0, 60) + '...' : desc}"`,
        applicable: true,
      };
    }

    return {
      id: 'doc-description',
      ruleName: 'Repository Description',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 15,
      summary: 'Missing repository description',
      explanation:
        'A concise description in repository settings helps discovery and immediate context.',
      applicable: true,
    };
  },
};

export const contributingRule: HealthRule = {
  id: 'doc-contributing',
  name: 'Contribution Guidelines',
  category: 'documentation',
  maxPoints: 15,
  evaluate(context: HealthRuleContext): HealthFinding {
    const contrib = context.tree.entries.find((e) =>
      /(^|\/)contributing(\.[a-z0-9]+)?$/i.test(e.path)
    );

    if (contrib) {
      return {
        id: 'doc-contributing',
        ruleName: 'Contribution Guidelines',
        kind: 'positive',
        pointsAwarded: 15,
        maxPoints: 15,
        summary: 'Contribution guide present',
        explanation:
          'A CONTRIBUTING guide explains workflows, branch rules, and pull request standards.',
        evidence: `Found "${contrib.path}".`,
        applicable: true,
      };
    }

    return {
      id: 'doc-contributing',
      ruleName: 'Contribution Guidelines',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 15,
      summary: 'No CONTRIBUTING guide detected',
      explanation:
        'Contributing guides reduce onboarding friction for prospective open-source contributors.',
      applicable: true,
    };
  },
};

export const codeOfConductRule: HealthRule = {
  id: 'doc-code-of-conduct',
  name: 'Code of Conduct',
  category: 'documentation',
  maxPoints: 10,
  evaluate(context: HealthRuleContext): HealthFinding {
    const coc = context.tree.entries.find((e) =>
      /(^|\/)code_of_conduct(\.[a-z0-9]+)?$/i.test(e.path)
    );

    if (coc) {
      return {
        id: 'doc-code-of-conduct',
        ruleName: 'Code of Conduct',
        kind: 'positive',
        pointsAwarded: 10,
        maxPoints: 10,
        summary: 'Code of Conduct present',
        explanation: 'Establishes behavioral expectations and community moderation standards.',
        evidence: `Found "${coc.path}".`,
        applicable: true,
      };
    }

    return {
      id: 'doc-code-of-conduct',
      ruleName: 'Code of Conduct',
      kind: 'neutral',
      pointsAwarded: 0,
      maxPoints: 10,
      summary: 'No Code of Conduct detected',
      explanation: 'Recommended for multi-contributor community projects.',
      applicable: true,
    };
  },
};

export const changelogRule: HealthRule = {
  id: 'doc-changelog',
  name: 'Changelog / Release History',
  category: 'documentation',
  maxPoints: 10,
  evaluate(context: HealthRuleContext): HealthFinding {
    const changelog = context.tree.entries.find((e) =>
      /(^|\/)(changelog|history|releases)(\.[a-z0-9]+)?$/i.test(e.path)
    );

    if (changelog) {
      return {
        id: 'doc-changelog',
        ruleName: 'Changelog / Release History',
        kind: 'positive',
        pointsAwarded: 10,
        maxPoints: 10,
        summary: 'Changelog file present',
        explanation:
          'Maintains human-readable history of major updates, features, and breaking changes.',
        evidence: `Found "${changelog.path}".`,
        applicable: true,
      };
    }

    return {
      id: 'doc-changelog',
      ruleName: 'Changelog / Release History',
      kind: 'neutral',
      pointsAwarded: 0,
      maxPoints: 10,
      summary: 'No CHANGELOG file detected',
      explanation:
        'Maintaining a CHANGELOG helps downstream users track evolution between releases.',
      applicable: true,
    };
  },
};

export const documentationRules: readonly HealthRule[] = [
  readmeRule,
  licenseRule,
  descriptionRule,
  contributingRule,
  codeOfConductRule,
  changelogRule,
];
