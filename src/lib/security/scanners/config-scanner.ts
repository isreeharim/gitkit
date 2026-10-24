import type { SecurityFinding } from '@/types/security';
import type { RepositoryTree } from '@/types/repository';

export interface FileContentToScan {
  readonly path: string;
  readonly content: string;
}

/**
 * Deterministically scans repository configuration files, Dockerfiles, and CI workflows
 * for dangerous security anti-patterns.
 */
export class ConfigScanner {
  scanTreeAndContents(
    tree: RepositoryTree,
    files: readonly FileContentToScan[]
  ): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    // 1. Scan tree for suspicious git or module configuration files
    for (const entry of tree.entries) {
      if (entry.type !== 'blob') continue;

      if (entry.name === '.gitmodules') {
        const fileContent = files.find((f) => f.path === entry.path)?.content;
        if (fileContent && /(?:http:\/\/|git:\/\/)/i.test(fileContent)) {
          findings.push({
            id: `config-insecure-submodule-${entry.path}`,
            type: 'configuration',
            severity: 'medium',
            ruleId: 'cfg-insecure-submodule-url',
            detector: 'config-analyzer',
            file: entry.path,
            message: 'Insecure Git submodule protocol detected (unencrypted http:// or git://)',
            evidence: 'Submodule URL uses unencrypted protocol susceptible to MITM tampering.',
            confidence: 'high',
            remediation:
              'Update git submodule URLs in .gitmodules to use secure https:// or ssh:// protocols.',
          });
        }
      }
    }

    // 2. Scan file contents
    for (const file of files) {
      const pathLower = file.path.toLowerCase();
      const content = file.content;
      const lines = content.split('\n');

      // Dockerfile checks
      if (pathLower.endsWith('dockerfile') || pathLower.includes('dockerfile.')) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          // Hardcoded password in Dockerfile ENV
          if (/^\s*ENV\s+.*(?:password|passwd|secret)\s*=/i.test(line)) {
            findings.push({
              id: `config-dockerfile-secret-${file.path}-${lineNum}`,
              type: 'configuration',
              severity: 'high',
              ruleId: 'cfg-dockerfile-hardcoded-secret',
              detector: 'config-analyzer',
              file: file.path,
              line: lineNum,
              message: 'Hardcoded password or secret defined in Dockerfile ENV directive',
              evidence: `Line ${lineNum}: ENV directive defines sensitive credential variable.`,
              confidence: 'high',
              remediation:
                'Use Docker BuildKit secrets (--secret) or runtime container environment variables rather than embedding credentials in image metadata.',
            });
          }
        }
      }

      // GitHub Actions CI Workflow checks
      if (
        pathLower.startsWith('.github/workflows/') &&
        (pathLower.endsWith('.yml') || pathLower.endsWith('.yaml'))
      ) {
        let hasPullRequestTarget = false;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineNum = i + 1;

          if (/pull_request_target/i.test(line)) {
            hasPullRequestTarget = true;
          }

          if (
            hasPullRequestTarget &&
            /ref:\s*\${{\s*github\.event\.pull_request\.head\.sha\s*}}/i.test(line)
          ) {
            findings.push({
              id: `config-ci-pwn-request-${file.path}-${lineNum}`,
              type: 'configuration',
              severity: 'critical',
              ruleId: 'cfg-ci-pull-request-target-pwn',
              detector: 'config-analyzer',
              file: file.path,
              line: lineNum,
              message:
                'High-risk pull_request_target checkout of untrusted PR head commit detected',
              evidence: `Line ${lineNum}: actions/checkout uses untrusted pull request head SHA under elevated repository tokens.`,
              confidence: 'high',
              remediation:
                'Avoid checking out untrusted fork code under pull_request_target workflows. Use pull_request instead, or isolate untrusted script execution.',
              references: [
                'https://securitylab.github.com/research/github-actions-preventing-pwn-requests/',
              ],
            });
          }

          // Unpinned third-party actions using @master or @main
          if (/uses:\s*[^@\s]+\/(?:[^@\s]+)@(main|master)\b/i.test(line)) {
            findings.push({
              id: `config-ci-unpinned-action-${file.path}-${lineNum}`,
              type: 'configuration',
              severity: 'low',
              ruleId: 'cfg-ci-unpinned-action',
              detector: 'config-analyzer',
              file: file.path,
              line: lineNum,
              message: 'Third-party GitHub Action pinned to mutable branch (@main or @master)',
              evidence: `Line ${lineNum}: Action reference points to mutable branch instead of immutable commit SHA.`,
              confidence: 'high',
              remediation:
                'Pin third-party GitHub Actions to a full 40-character commit SHA (e.g. @a1b2c3d...) to protect against supply chain compromise.',
            });
          }
        }
      }

      // Package.json unsafe curl piping in lifecycle scripts
      if (entryMatchesFilename(file.path, 'package.json')) {
        if (/(?:curl|wget)\s+[^|]+\|\s*(?:sh|bash)/i.test(content)) {
          findings.push({
            id: `config-pkg-curl-pipe-${file.path}`,
            type: 'configuration',
            severity: 'high',
            ruleId: 'cfg-package-unsafe-script-curl',
            detector: 'config-analyzer',
            file: file.path,
            message: 'Unsafe remote script execution (curl | sh or wget | bash) in package.json',
            evidence: 'Package script downloads and executes unverified remote shell script.',
            confidence: 'high',
            remediation:
              'Avoid piping unverified remote scripts to bash. Vendor the required tool or install precompiled packages with integrity hashes.',
          });
        }
      }
    }

    return findings;
  }
}

function entryMatchesFilename(path: string, targetName: string): boolean {
  const parts = path.split('/');
  return parts[parts.length - 1] === targetName;
}
