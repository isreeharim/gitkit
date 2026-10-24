import type { SecurityFinding, SecurityFindingSeverity } from '@/types/security';
import type { PackageDependency, PackageEcosystem } from '@/types/dependency';

export interface OSVPackageQuery {
  package: {
    name: string;
    ecosystem: string;
  };
  version?: string;
}

export interface OSVBatchRequest {
  queries: OSVPackageQuery[];
}

export interface OSVVulnerabilityItem {
  id: string;
  summary?: string;
  details?: string;
  aliases?: string[];
  database_specific?: {
    severity?: string;
  };
  severity?: Array<{
    type: string;
    score: string;
  }>;
  affected?: Array<{
    package?: {
      name: string;
      ecosystem: string;
    };
    ranges?: Array<{
      type: string;
      events: Array<{
        introduced?: string;
        fixed?: string;
      }>;
    }>;
  }>;
}

export interface OSVBatchResponse {
  results?: Array<{
    vulns?: OSVVulnerabilityItem[];
  }>;
}

export interface IOSVScanner {
  scanPackages(packages: readonly PackageDependency[]): Promise<{
    findings: SecurityFinding[];
    isAvailable: boolean;
  }>;
}

/**
 * Maps GitKit's PackageEcosystem to OSV's official ecosystem names.
 */
export function mapEcosystemToOSV(eco: PackageEcosystem): string | null {
  switch (eco) {
    case 'npm':
      return 'npm';
    case 'pypi':
      return 'PyPI';
    case 'cargo':
      return 'crates.io';
    case 'gomod':
      return 'Go';
    default:
      return null;
  }
}

/**
 * Cleans a semantic version constraint string into a clean testable version number.
 * e.g. "^4.17.15" -> "4.17.15", ">= 1.2.0" -> "1.2.0", "~0.10.1" -> "0.10.1"
 */
export function cleanVersionConstraint(constraint: string): string | null {
  if (!constraint) return null;
  const match = constraint.match(/\b(\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?)\b/);
  return match ? match[1] : null;
}

/**
 * Normalizes OSV severity strings or CVSS ratings to GitKit's standard severity levels.
 */
export function normalizeOSVSeverity(item: OSVVulnerabilityItem): SecurityFindingSeverity {
  const dbSeverity = item.database_specific?.severity?.toUpperCase();
  if (dbSeverity === 'CRITICAL') return 'critical';
  if (dbSeverity === 'HIGH') return 'high';
  if (dbSeverity === 'MODERATE' || dbSeverity === 'MEDIUM') return 'medium';
  if (dbSeverity === 'LOW') return 'low';

  // Fallback to CVSS score inspection
  if (item.severity && item.severity.length > 0) {
    for (const s of item.severity) {
      if (s.score) {
        // e.g. CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
        if (s.score.includes('/C:H/I:H/A:H')) return 'critical';
        if (s.score.includes('/C:H') || s.score.includes('/I:H') || s.score.includes('/A:H'))
          return 'high';
      }
    }
  }

  return 'medium';
}

/**
 * OSV-Scanner client querying the official Open Source Vulnerabilities API (https://osv.dev).
 */
export class OSVScanner implements IOSVScanner {
  private readonly apiUrl: string;
  private readonly customFetch?: typeof fetch;

  constructor(options?: { apiUrl?: string; fetch?: typeof fetch }) {
    this.apiUrl = options?.apiUrl || 'https://api.osv.dev/v1/querybatch';
    this.customFetch = options?.fetch;
  }

  async scanPackages(packages: readonly PackageDependency[]): Promise<{
    findings: SecurityFinding[];
    isAvailable: boolean;
  }> {
    if (!packages || packages.length === 0) {
      return { findings: [], isAvailable: true };
    }

    const queryItems: Array<{ dep: PackageDependency; query: OSVPackageQuery }> = [];

    for (const pkg of packages) {
      const osvEco = mapEcosystemToOSV(pkg.ecosystem);
      if (!osvEco) continue;

      const cleanVer = cleanVersionConstraint(pkg.versionConstraint);
      if (!cleanVer) continue;

      queryItems.push({
        dep: pkg,
        query: {
          package: {
            name: pkg.name,
            ecosystem: osvEco,
          },
          version: cleanVer,
        },
      });
    }

    if (queryItems.length === 0) {
      return { findings: [], isAvailable: true };
    }

    // Limit batch size to 100 queries to avoid timeouts
    const boundedItems = queryItems.slice(0, 100);
    const fetchFn = this.customFetch || fetch;

    try {
      const response = await fetchFn(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'GitKit-OSV-Scanner/1.0',
        },
        body: JSON.stringify({
          queries: boundedItems.map((item) => item.query),
        }),
      });

      if (!response.ok) {
        return { findings: [], isAvailable: false };
      }

      const data = (await response.json()) as OSVBatchResponse;
      const findings: SecurityFinding[] = [];

      if (data.results && Array.isArray(data.results)) {
        for (let i = 0; i < data.results.length; i++) {
          const res = data.results[i];
          const queryItem = boundedItems[i];
          if (!res?.vulns || res.vulns.length === 0 || !queryItem) continue;

          for (const vuln of res.vulns) {
            const severity = normalizeOSVSeverity(vuln);
            const summaryText =
              vuln.summary || vuln.details?.slice(0, 120) || 'Known package vulnerability';

            // Extract fixed version recommendation if available
            let fixedVer: string | undefined;
            if (vuln.affected) {
              for (const aff of vuln.affected) {
                if (aff.ranges) {
                  for (const r of aff.ranges) {
                    const fixEvent = r.events?.find((e) => Boolean(e.fixed));
                    if (fixEvent?.fixed) {
                      fixedVer = fixEvent.fixed;
                      break;
                    }
                  }
                }
              }
            }

            const remediationMsg = fixedVer
              ? `Upgrade "${queryItem.dep.name}" from ${queryItem.dep.versionConstraint} to version >= ${fixedVer} in ${queryItem.dep.manifestSource}.`
              : `Review advisory ${vuln.id} and update "${queryItem.dep.name}" in ${queryItem.dep.manifestSource}.`;

            const references: string[] = [`https://osv.dev/vulnerability/${vuln.id}`];
            if (vuln.aliases) {
              for (const alias of vuln.aliases) {
                if (alias.startsWith('GHSA-')) {
                  references.push(`https://github.com/advisories/${alias}`);
                } else if (alias.startsWith('CVE-')) {
                  references.push(`https://nvd.nist.gov/vuln/detail/${alias}`);
                }
              }
            }

            findings.push({
              id: `osv-${vuln.id}-${queryItem.dep.name}`,
              type: 'vulnerability',
              severity,
              ruleId: vuln.id,
              detector: 'osv-scanner',
              file: queryItem.dep.manifestSource,
              message: `Vulnerability in dependency ${queryItem.dep.name} (${queryItem.dep.versionConstraint}): ${summaryText}`,
              evidence: `Advisory: ${vuln.id} [${severity.toUpperCase()}]. Ecosystem: ${queryItem.dep.ecosystem}.`,
              confidence: 'high',
              remediation: remediationMsg,
              references,
            });
          }
        }
      }

      return { findings, isAvailable: true };
    } catch {
      // In case network or API is unavailable, gracefully fall back
      return { findings: [], isAvailable: false };
    }
  }
}
