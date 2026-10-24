import type { HealthRule, HealthRuleContext } from '../types';
import type { HealthFinding } from '@/types/health';
import { isManifestFile } from '@/lib/parser';

export const securityPolicyRule: HealthRule = {
  id: 'sec-policy',
  name: 'Security Vulnerability Disclosure Policy',
  category: 'security',
  maxPoints: 35,
  evaluate(context: HealthRuleContext): HealthFinding {
    const secPolicy = context.tree.entries.find((e) =>
      /(^|\/)security(\.[a-z0-9]+)?$/i.test(e.path)
    );

    if (secPolicy) {
      return {
        id: 'sec-policy',
        ruleName: 'Security Vulnerability Disclosure Policy',
        kind: 'positive',
        pointsAwarded: 35,
        maxPoints: 35,
        summary: 'SECURITY.md policy file is present',
        explanation:
          'Provides clear responsible disclosure instructions for external security researchers.',
        evidence: `Found "${secPolicy.path}".`,
        applicable: true,
      };
    }

    return {
      id: 'sec-policy',
      ruleName: 'Security Vulnerability Disclosure Policy',
      kind: 'neutral',
      pointsAwarded: 15,
      maxPoints: 35,
      summary: 'No explicit SECURITY.md policy detected',
      explanation:
        'Adding a SECURITY.md file guides researchers on how to report vulnerabilities privately.',
      applicable: true,
    };
  },
};

export const noCommittedSecretsRule: HealthRule = {
  id: 'sec-no-secrets',
  name: 'No Accidental Credential Exposure',
  category: 'security',
  maxPoints: 45,
  evaluate(context: HealthRuleContext): HealthFinding {
    // Scan for filenames matching common secret patterns
    const dangerousSecretPatterns =
      /^(\.env|\.env\.local|\.env\.production|id_rsa|id_ed25519|.*\.pem|.*\.key|credentials\.json)$/i;

    const leakedFiles = context.tree.entries.filter(
      (e) =>
        e.type === 'blob' &&
        dangerousSecretPatterns.test(e.name) &&
        !e.name.includes('.example') &&
        !e.name.includes('.template') &&
        !e.name.includes('.sample')
    );

    if (leakedFiles.length === 0) {
      return {
        id: 'sec-no-secrets',
        ruleName: 'No Accidental Credential Exposure',
        kind: 'positive',
        pointsAwarded: 45,
        maxPoints: 45,
        summary: 'No plaintext credentials or private keys detected in repository tree',
        explanation:
          'Repository tree scan verified zero filenames matching private keys or .env secrets.',
        evidence: '0 exposed credential files found.',
        applicable: true,
      };
    }

    return {
      id: 'sec-no-secrets',
      ruleName: 'No Accidental Credential Exposure',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 45,
      summary: `Potential secret files detected (${leakedFiles.length} ${leakedFiles.length === 1 ? 'file' : 'files'})`,
      explanation:
        'Files matching credential/key naming conventions should never be committed to public repositories.',
      evidence: `Found: ${leakedFiles.map((f) => `"${f.path}"`).join(', ')}.`,
      applicable: true,
    };
  },
};

export const lockfileIntegrityRule: HealthRule = {
  id: 'sec-lockfile-integrity',
  name: 'Supply Chain Lockfile Integrity',
  category: 'security',
  maxPoints: 20,
  evaluate(context: HealthRuleContext): HealthFinding {
    const hasManifest = context.tree.entries.some(
      (e) => e.type === 'blob' && isManifestFile(e.path)
    );

    if (!hasManifest) {
      return {
        id: 'sec-lockfile-integrity',
        ruleName: 'Supply Chain Lockfile Integrity',
        kind: 'neutral',
        pointsAwarded: 20,
        maxPoints: 20,
        summary: 'No external package supply chain',
        explanation: 'No package manifests requiring hash verification.',
        applicable: false,
      };
    }

    const hasLockfile = context.tree.entries.some((e) =>
      /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|go\.sum|bun\.lockb)$/i.test(
        e.name
      )
    );

    if (hasLockfile) {
      return {
        id: 'sec-lockfile-integrity',
        ruleName: 'Supply Chain Lockfile Integrity',
        kind: 'positive',
        pointsAwarded: 20,
        maxPoints: 20,
        summary: 'Package checksums locked via lockfile',
        explanation: 'Locks package integrity hashes against supply-chain substitution attacks.',
        evidence: 'Lockfile present.',
        applicable: true,
      };
    }

    return {
      id: 'sec-lockfile-integrity',
      ruleName: 'Supply Chain Lockfile Integrity',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 20,
      summary: 'Missing supply chain lockfile',
      explanation:
        'Manifests without locked package versions and integrity hashes risk supply-chain drift.',
      applicable: true,
    };
  },
};

export const securityRules: readonly HealthRule[] = [
  securityPolicyRule,
  noCommittedSecretsRule,
  lockfileIntegrityRule,
];
