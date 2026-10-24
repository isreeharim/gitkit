import type { HealthRule, HealthRuleContext } from '../types';
import type { HealthFinding } from '@/types/health';

export const recentActivityWindowRule: HealthRule = {
  id: 'activity-recent-window',
  name: 'Recent Evolution & Push Cadence',
  category: 'activity',
  maxPoints: 40,
  evaluate(context: HealthRuleContext): HealthFinding {
    // Determine most recent date from commits or pushedAt
    let latestDateMs: number | null = null;
    let source = '';

    if (context.commits && context.commits.length > 0) {
      const timestamps = context.commits.map(
        (c) => c.author.timestamp || new Date(c.author.date).getTime()
      );
      latestDateMs = Math.max(...timestamps);
      source = 'latest commit';
    } else if (context.metadata.pushedAt) {
      latestDateMs = new Date(context.metadata.pushedAt).getTime();
      source = 'last push';
    }

    if (!latestDateMs || isNaN(latestDateMs)) {
      return {
        id: 'activity-recent-window',
        ruleName: 'Recent Evolution & Push Cadence',
        kind: 'neutral',
        pointsAwarded: 20,
        maxPoints: 40,
        summary: 'Commit activity date unavailable',
        explanation: 'No recent commit timestamp was available for this repository.',
        applicable: true,
      };
    }

    const nowMs = Date.now();
    const ageDays = Math.max(0, (nowMs - latestDateMs) / (1000 * 60 * 60 * 24));
    const isoStr = new Date(latestDateMs).toISOString().split('T')[0];

    if (ageDays <= 30) {
      return {
        id: 'activity-recent-window',
        ruleName: 'Recent Evolution & Push Cadence',
        kind: 'positive',
        pointsAwarded: 40,
        maxPoints: 40,
        summary: `Actively maintained (pushed within last 30 days)`,
        explanation: 'The repository exhibits continuous development activity and recent updates.',
        evidence: `Last activity: ${isoStr} (~${Math.round(ageDays)} days ago via ${source}).`,
        applicable: true,
      };
    }

    if (ageDays <= 90) {
      return {
        id: 'activity-recent-window',
        ruleName: 'Recent Evolution & Push Cadence',
        kind: 'positive',
        pointsAwarded: 30,
        maxPoints: 40,
        summary: `Recently active (pushed within last 90 days)`,
        explanation: 'Repository receives steady periodic updates.',
        evidence: `Last activity: ${isoStr} (~${Math.round(ageDays)} days ago via ${source}).`,
        applicable: true,
      };
    }

    if (ageDays <= 180) {
      return {
        id: 'activity-recent-window',
        ruleName: 'Recent Evolution & Push Cadence',
        kind: 'neutral',
        pointsAwarded: 20,
        maxPoints: 40,
        summary: `Semi-active (last pushed within 6 months)`,
        explanation: 'Repository may be in maintenance mode or a stable, completed library.',
        evidence: `Last activity: ${isoStr} (~${Math.round(ageDays)} days ago).`,
        applicable: true,
      };
    }

    if (ageDays <= 365) {
      return {
        id: 'activity-recent-window',
        ruleName: 'Recent Evolution & Push Cadence',
        kind: 'negative',
        pointsAwarded: 10,
        maxPoints: 40,
        summary: `Inactive (no pushes for over 6 months)`,
        explanation:
          'No recent activity detected. While common for stable tools, it may signal an abandoned codebase.',
        evidence: `Last activity: ${isoStr} (~${Math.round(ageDays)} days ago).`,
        applicable: true,
      };
    }

    return {
      id: 'activity-recent-window',
      ruleName: 'Recent Evolution & Push Cadence',
      kind: 'negative',
      pointsAwarded: 0,
      maxPoints: 40,
      summary: `Dormant (no pushes for over a year)`,
      explanation: 'No activity detected for more than 12 months; repository appears dormant.',
      evidence: `Last activity: ${isoStr} (~${Math.round(ageDays)} days ago).`,
      applicable: true,
    };
  },
};

export const commitVolumeRule: HealthRule = {
  id: 'activity-commit-volume',
  name: 'Historical Commit Volume',
  category: 'activity',
  maxPoints: 30,
  evaluate(context: HealthRuleContext): HealthFinding {
    // Check metrics activity or commit count
    const totalCommits = context.metrics?.activity.commitCount ?? context.commits?.length ?? 0;

    if (totalCommits >= 50) {
      return {
        id: 'activity-commit-volume',
        ruleName: 'Historical Commit Volume',
        kind: 'positive',
        pointsAwarded: 30,
        maxPoints: 30,
        summary: `Substantial development history (${totalCommits}+ commits)`,
        explanation:
          'Extensive commit history reflects an established, iteratively developed project.',
        evidence: `Verified ${totalCommits} commits in repository history.`,
        applicable: true,
      };
    }

    if (totalCommits >= 10) {
      return {
        id: 'activity-commit-volume',
        ruleName: 'Historical Commit Volume',
        kind: 'positive',
        pointsAwarded: 25,
        maxPoints: 30,
        summary: `Moderate commit history (${totalCommits} commits)`,
        explanation: 'Adequate commit history for standard utility packages and focused tools.',
        evidence: `${totalCommits} commits.`,
        applicable: true,
      };
    }

    return {
      id: 'activity-commit-volume',
      ruleName: 'Historical Commit Volume',
      kind: 'neutral',
      pointsAwarded: 15,
      maxPoints: 30,
      summary: `Light commit history (${totalCommits} commits)`,
      explanation: 'Typical for newly minted repositories or concise single-purpose utilities.',
      evidence: `${totalCommits} commits recorded.`,
      applicable: true,
    };
  },
};

export const maintainerBaseRule: HealthRule = {
  id: 'activity-maintainer-base',
  name: 'Maintainer & Contributor Base',
  category: 'activity',
  maxPoints: 30,
  evaluate(context: HealthRuleContext): HealthFinding {
    const contributorCount = context.metrics?.activity.contributorCount;

    if (typeof contributorCount === 'number' && contributorCount >= 3) {
      return {
        id: 'activity-maintainer-base',
        ruleName: 'Maintainer & Contributor Base',
        kind: 'positive',
        pointsAwarded: 30,
        maxPoints: 30,
        summary: `Multi-contributor community (${contributorCount} contributors)`,
        explanation: 'Diverse contributor base mitigates single-maintainer bus factor risk.',
        evidence: `${contributorCount} contributors registered on GitHub.`,
        applicable: true,
      };
    }

    if (typeof contributorCount === 'number' && contributorCount === 2) {
      return {
        id: 'activity-maintainer-base',
        ruleName: 'Maintainer & Contributor Base',
        kind: 'positive',
        pointsAwarded: 25,
        maxPoints: 30,
        summary: 'Collaborative development (2 contributors)',
        explanation: 'At least two developers have contributed code to this project.',
        evidence: '2 contributors.',
        applicable: true,
      };
    }

    return {
      id: 'activity-maintainer-base',
      ruleName: 'Maintainer & Contributor Base',
      kind: 'neutral',
      pointsAwarded: 20,
      maxPoints: 30,
      summary: 'Solo maintainer repository',
      explanation:
        'Common across open-source. Solo maintainers are respected and receive baseline points.',
      evidence: '1 contributor detected.',
      applicable: true,
    };
  },
};

export const activityRules: readonly HealthRule[] = [
  recentActivityWindowRule,
  commitVolumeRule,
  maintainerBaseRule,
];
