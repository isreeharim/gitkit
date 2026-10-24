import type { GitCommit, ActivityPeriod } from '@/types/git';

/**
 * Deterministically buckets commits into chronological weekly or daily activity periods.
 */
export function buildActivityTimeline(commits: readonly GitCommit[]): ActivityPeriod[] {
  if (commits.length === 0) return [];

  // Sort commits chronologically ascending
  const sorted = commits.slice().sort((a, b) => {
    const tA = a.author.timestamp || new Date(a.author.date).getTime();
    const tB = b.author.timestamp || new Date(b.author.date).getTime();
    return tA - tB;
  });

  interface PeriodAccumulator {
    periodKey: string;
    label: string;
    commitCount: number;
    additions: number;
    deletions: number;
    authors: Set<string>;
  }

  const periodMap = new Map<string, PeriodAccumulator>();

  for (const commit of sorted) {
    const date = new Date(commit.author.date);
    // Use ISO Week: YYYY-Www format
    const year = date.getUTCFullYear();
    const weekNum = getIsoWeekNumber(date);
    const periodKey = `${year}-W${String(weekNum).padStart(2, '0')}`;
    const label = `Week ${weekNum}, ${year}`;

    const existing = periodMap.get(periodKey) || {
      periodKey,
      label,
      commitCount: 0,
      additions: 0,
      deletions: 0,
      authors: new Set<string>(),
    };

    existing.commitCount += 1;
    existing.additions += commit.additions;
    existing.deletions += commit.deletions;
    if (commit.author.name) {
      existing.authors.add(commit.author.name);
    }

    periodMap.set(periodKey, existing);
  }

  return Array.from(periodMap.values()).map((p) => ({
    periodKey: p.periodKey,
    label: p.label,
    commitCount: p.commitCount,
    additions: p.additions,
    deletions: p.deletions,
    uniqueAuthors: Array.from(p.authors).sort(),
  }));
}

/**
 * Computes the ISO 8601 week number (1-53) for a given UTC date.
 */
function getIsoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
