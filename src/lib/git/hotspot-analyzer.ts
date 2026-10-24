import type { GitCommit, FileHotspot, HotspotActivityTier } from '@/types/git';

export interface HotspotAnalyzerOptions {
  referenceDate?: Date; // Reference date for recency calculation (defaults to latest commit date)
  recencyWindowDays?: number; // Days window for full recency weight (default: 90)
  minRecencyWeight?: number; // Baseline floor weight for older commits (default: 0.2)
  topLimit?: number;
}

export const HOTSPOT_FORMULA_DOCUMENTATION =
  'Repository Hotspot Score = round( 100 * (C * ln(L + 1) * R) / MaxScore ), where C = commit change frequency count, L = total lines changed (additions + deletions), and R = average recency weight (commits within 90 days scaled linearly from 1.0 to baseline 0.2).';

/**
 * Deterministically computes file churn and code hotspots across an analyzed commit sequence.
 * Uses an explainable formula combining change frequency, line volume (log-scaled), and recency weighting.
 */
export function analyzeCodeHotspots(
  commits: readonly GitCommit[],
  options: HotspotAnalyzerOptions = {}
): FileHotspot[] {
  if (commits.length === 0) return [];

  const recencyWindowDays = options.recencyWindowDays ?? 90;
  const minRecencyWeight = options.minRecencyWeight ?? 0.2;
  const topLimit = options.topLimit ?? 20;

  // Determine latest commit timestamp as reference date to avoid wall-clock dependency
  const latestTimestamp = Math.max(
    ...commits.map((c) => c.author.timestamp || new Date(c.author.date).getTime())
  );
  const refTimeMs = options.referenceDate ? options.referenceDate.getTime() : latestTimestamp;

  // Aggregate file changes: path -> stats
  interface FileStatsAccumulator {
    path: string;
    name: string;
    commitCount: number;
    additions: number;
    deletions: number;
    totalLines: number;
    recentChanges: number;
    lastChangedMs: number;
    recencyWeightsSum: number;
  }

  const fileMap = new Map<string, FileStatsAccumulator>();

  for (const commit of commits) {
    const commitTimeMs = commit.author.timestamp || new Date(commit.author.date).getTime();
    const ageDays = Math.max(0, (refTimeMs - commitTimeMs) / (1000 * 60 * 60 * 24));

    // Linear recency decay: 1.0 down to minRecencyWeight at recencyWindowDays
    let recencyWeight = minRecencyWeight;
    if (ageDays <= recencyWindowDays) {
      recencyWeight = 1 - (1 - minRecencyWeight) * (ageDays / recencyWindowDays);
    }
    const isRecent = ageDays <= 30;

    for (const file of commit.files) {
      const existing = fileMap.get(file.path) || {
        path: file.path,
        name: file.path.split('/').pop() || file.path,
        commitCount: 0,
        additions: 0,
        deletions: 0,
        totalLines: 0,
        recentChanges: 0,
        lastChangedMs: 0,
        recencyWeightsSum: 0,
      };

      existing.commitCount += 1;
      existing.additions += file.additions;
      existing.deletions += file.deletions;
      existing.totalLines += file.changes;
      existing.lastChangedMs = Math.max(existing.lastChangedMs, commitTimeMs);
      existing.recencyWeightsSum += recencyWeight;
      if (isRecent) {
        existing.recentChanges += 1;
      }

      fileMap.set(file.path, existing);
    }
  }

  if (fileMap.size === 0) return [];

  // Calculate raw scores and determine max for 0-100 normalization
  interface ScoredFileIntermediate {
    stats: FileStatsAccumulator;
    frequencyFactor: number;
    volumeFactor: number;
    recencyFactor: number;
    rawScore: number;
  }

  const scoredFiles: ScoredFileIntermediate[] = [];
  let maxRawScore = 0;

  for (const stats of fileMap.values()) {
    const frequencyFactor = stats.commitCount;
    // Logarithmic scaling for line volume prevents massive auto-generated files from dominating
    const volumeFactor = Math.log(stats.totalLines + 1);
    const recencyFactor = stats.recencyWeightsSum / stats.commitCount;

    const rawScore = frequencyFactor * volumeFactor * recencyFactor;
    if (rawScore > maxRawScore) {
      maxRawScore = rawScore;
    }

    scoredFiles.push({
      stats,
      frequencyFactor,
      volumeFactor,
      recencyFactor,
      rawScore,
    });
  }

  // Convert to normalized FileHotspot models
  const results: FileHotspot[] = scoredFiles.map((item) => {
    const { stats, frequencyFactor, volumeFactor, recencyFactor, rawScore } = item;
    const normalizedScore = maxRawScore > 0 ? Math.round((rawScore / maxRawScore) * 100) : 0;

    let tier: HotspotActivityTier = 'stable';
    if (normalizedScore >= 75) {
      tier = 'critical_churn';
    } else if (normalizedScore >= 50) {
      tier = 'high_churn';
    } else if (normalizedScore >= 25) {
      tier = 'moderate_churn';
    }

    return {
      path: stats.path,
      name: stats.name,
      changeCount: stats.commitCount,
      additions: stats.additions,
      deletions: stats.deletions,
      totalLinesChanged: stats.totalLines,
      recentChangeCount: stats.recentChanges,
      lastChangedDate: new Date(stats.lastChangedMs).toISOString(),
      hotspotScore: normalizedScore,
      tier,
      scoreBreakdown: {
        frequencyFactor,
        volumeFactor: Number(volumeFactor.toFixed(3)),
        recencyFactor: Number(recencyFactor.toFixed(3)),
        rawScore: Number(rawScore.toFixed(3)),
      },
    };
  });

  // Sort descending by hotspot score, then by changeCount, then path alphabetically
  return results
    .sort(
      (a, b) =>
        b.hotspotScore - a.hotspotScore ||
        b.changeCount - a.changeCount ||
        a.path.localeCompare(b.path)
    )
    .slice(0, topLimit);
}
