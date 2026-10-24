/**
 * Severity levels for deterministic security findings.
 */
export type SecurityFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/**
 * Categories of security findings.
 */
export type SecurityFindingType = 'secret' | 'vulnerability' | 'configuration';

/**
 * Confidence rating of deterministic detection.
 */
export type SecurityFindingConfidence = 'high' | 'medium' | 'low';

/**
 * Single normalized deterministic security finding.
 */
export interface SecurityFinding {
  readonly id: string;
  readonly type: SecurityFindingType;
  readonly severity: SecurityFindingSeverity;
  readonly ruleId: string;
  readonly detector: string;
  readonly file: string;
  readonly line?: number;
  readonly message: string;
  readonly evidence: string;
  readonly confidence: SecurityFindingConfidence;
  readonly remediation?: string;
  readonly references?: readonly string[];
}

/**
 * Aggregated summary metrics for a security audit report.
 */
export interface SecurityReportSummary {
  readonly totalFindings: number;
  readonly bySeverity: Record<SecurityFindingSeverity, number>;
  readonly byType: Record<SecurityFindingType, number>;
  readonly scannersRun: readonly string[];
}

/**
 * Complete normalized repository security report.
 */
export interface SecurityReport {
  readonly repoId: string;
  readonly generatedAt: string;
  readonly summary: SecurityReportSummary;
  readonly findings: readonly SecurityFinding[];
  readonly dependencyScanAvailable: boolean;
  readonly methodology: {
    readonly version: string;
    readonly description: string;
    readonly detectors: readonly string[];
  };
}
