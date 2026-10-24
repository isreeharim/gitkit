import { describe, it, expect } from 'vitest';
import type { WorkspaceSection } from '@/types/workspace';

describe('GitKit Unified Workspace Navigation & Layout', () => {
  const owner = 'octocat';
  const repo = 'Hello-World';
  const baseUrl = `/${owner}/${repo}`;

  const expectedTabs: Array<{ id: WorkspaceSection; label: string; href: string }> = [
    { id: 'overview', label: 'Overview', href: baseUrl },
    { id: 'map', label: 'Map', href: `${baseUrl}/map` },
    { id: 'dependencies', label: 'Dependencies', href: `${baseUrl}/dependencies` },
    { id: 'git', label: 'Git', href: `${baseUrl}/git` },
    { id: 'pulls', label: 'Pull Requests', href: `${baseUrl}/pulls` },
    { id: 'health', label: 'Health', href: `${baseUrl}/health` },
    { id: 'security', label: 'Security', href: `${baseUrl}/security` },
  ];

  it('defines all 7 primary workspace navigation sections with deterministic paths', () => {
    expect(expectedTabs).toHaveLength(7);

    for (const tab of expectedTabs) {
      expect(tab.href.startsWith(baseUrl)).toBe(true);
      if (tab.id === 'overview') {
        expect(tab.href).toBe('/octocat/Hello-World');
      } else {
        expect(tab.href).toBe(`/octocat/Hello-World/${tab.id}`);
      }
    }
  });

  it('correctly maps URL pathname to active workspace section', () => {
    function resolveActiveSection(pathname: string): WorkspaceSection {
      const cleanPath = pathname.replace(/\/$/, '');
      if (cleanPath.endsWith('/map')) return 'map';
      if (cleanPath.endsWith('/dependencies')) return 'dependencies';
      if (cleanPath.endsWith('/git')) return 'git';
      if (cleanPath.includes('/pulls')) return 'pulls';
      if (cleanPath.endsWith('/health')) return 'health';
      if (cleanPath.endsWith('/security')) return 'security';
      return 'overview';
    }

    expect(resolveActiveSection('/octocat/Hello-World')).toBe('overview');
    expect(resolveActiveSection('/octocat/Hello-World/')).toBe('overview');
    expect(resolveActiveSection('/octocat/Hello-World/map')).toBe('map');
    expect(resolveActiveSection('/octocat/Hello-World/dependencies')).toBe('dependencies');
    expect(resolveActiveSection('/octocat/Hello-World/git')).toBe('git');
    expect(resolveActiveSection('/octocat/Hello-World/pulls')).toBe('pulls');
    expect(resolveActiveSection('/octocat/Hello-World/pulls/42')).toBe('pulls');
    expect(resolveActiveSection('/octocat/Hello-World/health')).toBe('health');
    expect(resolveActiveSection('/octocat/Hello-World/security')).toBe('security');
  });

  it('parses Pull Requests URL state query parameter deterministically', () => {
    function parsePrStateFilter(searchParams: URLSearchParams): 'all' | 'open' | 'closed' {
      const val = searchParams.get('state');
      if (val === 'open' || val === 'closed') return val;
      return 'all';
    }

    expect(parsePrStateFilter(new URLSearchParams(''))).toBe('all');
    expect(parsePrStateFilter(new URLSearchParams('state=open'))).toBe('open');
    expect(parsePrStateFilter(new URLSearchParams('state=closed'))).toBe('closed');
    expect(parsePrStateFilter(new URLSearchParams('state=invalid_filter'))).toBe('all');
  });

  it('calculates deterministic category percentages for overview health summary', () => {
    const categories = [
      { name: 'Documentation', score: 20, maxScore: 20 },
      { name: 'Testing', score: 10, maxScore: 20 },
      { name: 'Hygiene', score: 0, maxScore: 15 },
    ];

    const percentages = categories.map((c) =>
      c.maxScore > 0 ? Math.round((c.score / c.maxScore) * 100) : 0
    );

    expect(percentages).toEqual([100, 50, 0]);
  });

  it('determines security clean status based on total findings count', () => {
    function getSecurityStatus(totalFindings: number): 'clean' | 'attention_required' {
      return totalFindings === 0 ? 'clean' : 'attention_required';
    }

    expect(getSecurityStatus(0)).toBe('clean');
    expect(getSecurityStatus(1)).toBe('attention_required');
    expect(getSecurityStatus(5)).toBe('attention_required');
  });
});
