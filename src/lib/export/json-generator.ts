import type { GitKitExportInput, GitKitExportPayload } from '@/types/export';

export interface JsonExportOptions {
  readonly pretty?: boolean;
}

/**
 * Compiles a normalized, versioned GitKit JSON export payload.
 */
export function generateExportPayload(input: GitKitExportInput): GitKitExportPayload {
  const meta = input.metadata;

  const payload: {
    version: '1.0';
    schema: 'https://gitkit.in/schemas/v1.0/export.json';
    exportedAt: string;
    generator: 'GitKit 0.1.0';
    repository: GitKitExportPayload['repository'];
    metrics?: GitKitExportPayload['metrics'];
    repoMap?: GitKitExportPayload['repoMap'];
    dependencies?: GitKitExportPayload['dependencies'];
    health?: GitKitExportPayload['health'];
    security?: GitKitExportPayload['security'];
  } = {
    version: '1.0',
    schema: 'https://gitkit.in/schemas/v1.0/export.json',
    exportedAt: input.exportedAt || new Date().toISOString(),
    generator: 'GitKit 0.1.0',
    repository: {
      owner: meta.owner,
      name: meta.name,
      fullName: meta.fullName,
      url: meta.htmlUrl,
      defaultBranch: meta.defaultBranch,
      description: meta.description,
      license: meta.license ? meta.license.spdxId || meta.license.name : null,
      stars: meta.stars,
      forks: meta.forks,
      watchers: meta.watchers,
      openIssues: meta.openIssues,
      sizeKb: meta.sizeKb,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      pushedAt: meta.pushedAt,
    },
  };

  // Attach metrics if present
  if (input.metricsReport) {
    const r = input.metricsReport;
    const totalBytes = r.structure.languages.reduce((sum, l) => sum + l.totalBytes, 0);

    payload.metrics = {
      totalFiles: r.structure.totalFiles,
      totalDirectories: r.structure.totalDirectories,
      totalBytes,
      loc: r.code.loc
        ? {
            totalLines: r.code.loc.totalLines,
            codeLines: r.code.loc.codeLines,
            commentLines: r.code.loc.commentLines,
            blankLines: r.code.loc.blankLines,
          }
        : undefined,
      languageDistribution: Object.fromEntries(
        r.structure.languages.map((l) => [l.name, l.fileCount])
      ),
    };
  }

  // Attach repoMap if present
  if (input.repoGraph) {
    const g = input.repoGraph;
    payload.repoMap = {
      rootId: g.rootId,
      totalNodes: g.nodes.size,
      totalEdges: g.edges.length,
      nodes: Array.from(g.nodes.values()).map((n) => ({
        id: n.id,
        label: n.name,
        type: n.type,
        path: n.path,
        extension: n.type === 'file' ? n.extension : undefined,
        size: n.type === 'file' ? n.size : undefined,
        childCount: n.type === 'directory' ? n.childIds.length : undefined,
      })),
      edges: g.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    };
  }

  // Attach dependencies if present
  if (input.dependencyGraph) {
    const dg = input.dependencyGraph;
    const fileNodes = Array.from(dg.nodes.values()).filter((n) => n.type === 'file');
    const pkgNodes = Array.from(dg.nodes.values()).filter((n) => n.type === 'package');

    payload.dependencies = {
      internalModulesCount: fileNodes.length,
      externalPackagesCount: pkgNodes.length,
      totalEdges: dg.edges.length,
      hasCycles: dg.cycles.length > 0,
      cycles: dg.cycles.map((c) => c.files),
      nodes: Array.from(dg.nodes.values()).map((n) => ({
        id: n.id,
        name: n.name,
        type: n.type === 'file' ? 'internal' : 'external',
        inDegree: n.type === 'file' ? n.inDegree : 0,
        outDegree: n.type === 'file' ? n.outDegree : 0,
        inCycle: n.type === 'file' ? n.inCycle : false,
      })),
      edges: dg.edges.map((e) => ({
        id: e.id,
        source: e.sourceFile,
        target: e.target,
        kind: e.kind,
      })),
    };
  }

  // Attach health if present
  if (input.healthReport) {
    const hr = input.healthReport;
    payload.health = {
      overallScore: hr.overallScore,
      ratingTier: hr.ratingTier,
      categories: hr.categories.map((c) => ({
        id: c.category,
        name: c.label,
        score: c.score,
        maxScore: c.maxScore,
        percentage: c.percentage,
      })),
    };
  }

  // Attach security if present
  if (input.securityReport) {
    const sr = input.securityReport;
    payload.security = {
      summary: {
        totalFindings: sr.summary.totalFindings,
        bySeverity: sr.summary.bySeverity,
        byType: sr.summary.byType,
      },
      findingsCount: sr.findings.length,
      findings: sr.findings.map((f) => ({
        id: f.id,
        type: f.type,
        severity: f.severity,
        ruleId: f.ruleId,
        file: f.file,
        message: f.message,
        confidence: f.confidence,
      })),
    };
  }

  return payload;
}

/**
 * Serializes the GitKit export input into a JSON formatted string.
 */
export function generateExportJson(
  input: GitKitExportInput,
  options: JsonExportOptions = {}
): string {
  const payload = generateExportPayload(input);
  const pretty = options.pretty ?? true;
  return JSON.stringify(payload, null, pretty ? 2 : undefined);
}
