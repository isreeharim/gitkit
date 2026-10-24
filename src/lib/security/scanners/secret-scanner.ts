import type { SecurityFinding } from '@/types/security';
import type { RepositoryTree } from '@/types/repository';
import { SECRET_RULES, isLikelyFalsePositive } from '../rules/secret-rules';
import { maskSecret } from '../masking';

export interface FileContentToScan {
  readonly path: string;
  readonly content: string;
}

/**
 * Deterministically scans repository files and tree structure for committed secrets and API keys.
 */
export class SecretScanner {
  /**
   * Scans repository tree entries for exposed secret files (e.g. .env, private keys, credential files).
   */
  scanTree(tree: RepositoryTree): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const entry of tree.entries) {
      if (entry.type !== 'blob') continue;

      const pathLower = entry.path.toLowerCase();
      const nameLower = entry.name.toLowerCase();

      // Check for exposed environment files (excluding templates/examples)
      if (
        /^(\.env|\.env\.local|\.env\.production|\.env\.staging|\.env\.secrets)$/i.test(
          entry.name
        ) &&
        !nameLower.includes('example') &&
        !nameLower.includes('sample') &&
        !nameLower.includes('template')
      ) {
        findings.push({
          id: `secret-tree-env-${entry.path}`,
          type: 'secret',
          severity: 'high',
          ruleId: 'exposed-env-file',
          detector: 'gitleaks-tree-scanner',
          file: entry.path,
          message: 'Potential secret storage file (.env) committed to repository',
          evidence: `File "${entry.path}" is tracked in git.`,
          confidence: 'high',
          remediation:
            'Add .env to .gitignore, remove it from git tracking via git rm --cached, and rotate any committed secrets.',
        });
      }

      // Check for private keys and certificates
      if (
        /^(id_rsa|id_ed25519|id_dsa|.*\.pem|.*\.key|.*\.p12|.*\.pfx)$/i.test(entry.name) &&
        !pathLower.includes('test') &&
        !pathLower.includes('fixture') &&
        !pathLower.includes('mock')
      ) {
        findings.push({
          id: `secret-tree-key-${entry.path}`,
          type: 'secret',
          severity: 'critical',
          ruleId: 'exposed-private-key-file',
          detector: 'gitleaks-tree-scanner',
          file: entry.path,
          message: 'Cryptographic private key or certificate file detected in repository tree',
          evidence: `Private key artifact "${entry.path}" found in repository.`,
          confidence: 'high',
          remediation:
            'Remove this private key file immediately from source control and git history. Regenerate all associated cryptographic credentials.',
        });
      }

      // Check for credential dumps
      if (
        /^(credentials\.json|service-account.*\.json|client_secrets.*\.json)$/i.test(entry.name) &&
        !pathLower.includes('example') &&
        !pathLower.includes('sample') &&
        !pathLower.includes('template')
      ) {
        findings.push({
          id: `secret-tree-credentials-${entry.path}`,
          type: 'secret',
          severity: 'high',
          ruleId: 'exposed-credentials-file',
          detector: 'gitleaks-tree-scanner',
          file: entry.path,
          message: 'Service account or credentials configuration file tracked in git',
          evidence: `Credential file "${entry.path}" present in repository.`,
          confidence: 'high',
          remediation:
            'Store service account credentials in a secure environment secret manager rather than committing files to the repository.',
        });
      }
    }

    return findings;
  }

  /**
   * Scans the textual content of source files for matching secret patterns.
   */
  scanContents(files: readonly FileContentToScan[]): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    for (const file of files) {
      const isTestOrFixture = /(?:test|spec|fixture|mock|example|sample|vendor|dist|build)/i.test(
        file.path
      );

      const lines = file.content.split('\n');

      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        const lineNum = lineIndex + 1;

        for (const rule of SECRET_RULES) {
          // Reset regex state for global regexes
          rule.regex.lastIndex = 0;

          let match: RegExpExecArray | null;
          while ((match = rule.regex.exec(line)) !== null) {
            const secretValue = match[1] || match[0];

            if (isLikelyFalsePositive(secretValue)) {
              continue;
            }

            // In test files, reduce severity of generic patterns or skip
            let severity = rule.severity;
            let confidence = rule.confidence;

            if (isTestOrFixture) {
              if (rule.id.startsWith('generic-')) {
                // Ignore generic password/api_key matches in test files
                continue;
              }
              // Specific token prefixes (e.g. ghp_, AKIA) in test files might still be leaks
              confidence = 'medium';
              if (severity === 'critical') severity = 'high';
            }

            const maskedEvidence = maskSecret(secretValue);

            findings.push({
              id: `secret-${rule.id}-${file.path}-${lineNum}-${match.index}`,
              type: 'secret',
              severity,
              ruleId: rule.id,
              detector: 'gitleaks-content-scanner',
              file: file.path,
              line: lineNum,
              message: rule.message,
              evidence: `Matched: ${maskedEvidence}`,
              confidence,
              remediation: rule.remediation,
            });
          }
        }
      }
    }

    return findings;
  }
}
