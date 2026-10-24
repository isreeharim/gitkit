import type {
  SecurityReport,
  SecurityFinding,
  SecurityFindingSeverity,
  SecurityFindingType,
} from '@/types/security';
import type { RepositoryMetadata, RepositoryTree } from '@/types/repository';
import type { PackageDependency } from '@/types/dependency';
import { SecretScanner, type FileContentToScan } from './scanners/secret-scanner';
import { ConfigScanner } from './scanners/config-scanner';
import { OSVScanner, type IOSVScanner } from './scanners/osv-scanner';

export interface SecurityScanContext {
  readonly metadata: RepositoryMetadata;
  readonly tree: RepositoryTree;
  readonly files?: readonly FileContentToScan[];
  readonly packages?: readonly PackageDependency[];
  readonly osvScanner?: IOSVScanner;
}

const SEVERITY_ORDER: Record<SecurityFindingSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

/**
 * Deterministically analyzes repository security posture across secrets,
 * dependency vulnerabilities (OSV), and dangerous configurations.
 */
export async function analyzeRepositorySecurity(
  context: SecurityScanContext
): Promise<SecurityReport> {
  const secretScanner = new SecretScanner();
  const configScanner = new ConfigScanner();
  const osvScanner = context.osvScanner ?? new OSVScanner();

  const files = context.files ?? [];
  const allFindings: SecurityFinding[] = [];

  // 1. Run Secret Scanner on tree & files
  const treeSecretFindings = secretScanner.scanTree(context.tree);
  const contentSecretFindings = secretScanner.scanContents(files);
  allFindings.push(...treeSecretFindings, ...contentSecretFindings);

  // 2. Run Configuration Scanner
  const configFindings = configScanner.scanTreeAndContents(context.tree, files);
  allFindings.push(...configFindings);

  // 3. Run OSV Vulnerability Scanner if packages are provided
  let dependencyScanAvailable = true;
  if (context.packages && context.packages.length > 0) {
    const osvResult = await osvScanner.scanPackages(context.packages);
    allFindings.push(...osvResult.findings);
    dependencyScanAvailable = osvResult.isAvailable;
  }

  // Deduplicate findings by finding ID
  const seenIds = new Set<string>();
  const uniqueFindings: SecurityFinding[] = [];

  for (const f of allFindings) {
    if (!seenIds.has(f.id)) {
      seenIds.add(f.id);
      uniqueFindings.push(f);
    }
  }

  // Sort findings: critical -> high -> medium -> low -> info
  uniqueFindings.sort((a, b) => {
    const orderDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (orderDiff !== 0) return orderDiff;
    return a.file.localeCompare(b.file);
  });

  // Calculate summary counts
  const bySeverity: Record<SecurityFindingSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  const byType: Record<SecurityFindingType, number> = {
    secret: 0,
    vulnerability: 0,
    configuration: 0,
  };

  for (const f of uniqueFindings) {
    bySeverity[f.severity]++;
    byType[f.type]++;
  }

  return {
    repoId: `${context.metadata.owner}/${context.metadata.name}`,
    generatedAt: new Date().toISOString(),
    summary: {
      totalFindings: uniqueFindings.length,
      bySeverity,
      byType,
      scannersRun: ['gitleaks-rules', 'osv-scanner', 'config-analyzer'],
    },
    findings: uniqueFindings,
    dependencyScanAvailable,
    methodology: {
      version: '1.0.0',
      description:
        'GitKit Security Engine executes 100% deterministic pattern matching, Gitleaks-compatible regex rules, OpenSSF OSV vulnerability queries, and static configuration analysis without AI or heuristic guessing.',
      detectors: [
        'Gitleaks Secret Rules v8.18',
        'OpenSSF OSV Database v1.0',
        'Static Configuration Analyzer',
      ],
    },
  };
}
