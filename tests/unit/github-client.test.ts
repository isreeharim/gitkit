import { describe, it, expect, vi } from 'vitest';
import { GitHubClient, GitHubApiError } from '@/lib/github/client';
import type { Octokit } from 'octokit';

describe('GitHubClient', () => {
  it('successfully fetches and returns repository metadata', async () => {
    const mockRepoData = {
      id: 12345,
      name: 'react',
      full_name: 'facebook/react',
      private: false,
      html_url: 'https://github.com/facebook/react',
      description: 'The library for web and native user interfaces.',
      fork: false,
      archived: false,
      created_at: '2013-05-24T16:15:54Z',
      updated_at: '2026-03-01T12:00:00Z',
      pushed_at: '2026-03-01T12:00:00Z',
      size: 154200,
      stargazers_count: 220000,
      watchers_count: 220000,
      forks_count: 45000,
      open_issues_count: 950,
      language: 'JavaScript',
      default_branch: 'main',
      owner: { login: 'facebook' },
      license: { key: 'mit', name: 'MIT License', spdx_id: 'MIT', url: null },
    };

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn().mockResolvedValue({ data: mockRepoData }),
        },
        git: {
          getTree: vi.fn(),
        },
      },
    } as unknown as Octokit;

    const client = new GitHubClient({ octokit: mockOctokit });
    const repo = await client.fetchRepository('facebook', 'react');

    expect(repo.name).toBe('react');
    expect(repo.full_name).toBe('facebook/react');
    expect(repo.stargazers_count).toBe(220000);
  });

  it('successfully fetches and returns repository tree', async () => {
    const mockTreeData = {
      sha: 'main-tree-sha',
      url: 'https://api.github.com/repos/facebook/react/git/trees/main-tree-sha',
      truncated: false,
      tree: [
        { path: 'src', mode: '040000', type: 'tree', sha: 'sha-dir' },
        { path: 'package.json', mode: '100644', type: 'blob', size: 1240, sha: 'sha-file' },
      ],
    };

    const mockOctokit = {
      rest: {
        repos: { get: vi.fn() },
        git: {
          getTree: vi.fn().mockResolvedValue({ data: mockTreeData }),
        },
      },
    } as unknown as Octokit;

    const client = new GitHubClient({ octokit: mockOctokit });
    const tree = await client.fetchTree('facebook', 'react', 'main');

    expect(tree.sha).toBe('main-tree-sha');
    expect(tree.tree).toHaveLength(2);
    expect(tree.truncated).toBe(false);
  });

  it('maps HTTP 404 to not_found error', async () => {
    const error404 = {
      status: 404,
      message: 'Not Found',
      response: { data: { message: 'Not Found' } },
    };

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn().mockRejectedValue(error404),
        },
      },
    } as unknown as Octokit;

    const client = new GitHubClient({ octokit: mockOctokit });

    await expect(client.fetchRepository('facebook', 'nonexistent')).rejects.toThrow(GitHubApiError);

    try {
      await client.fetchRepository('facebook', 'nonexistent');
    } catch (err) {
      const apiErr = err as GitHubApiError;
      expect(apiErr.kind).toBe('not_found');
      expect(apiErr.status).toBe(404);
      expect(apiErr.message).toContain('was not found on GitHub');
    }
  });

  it('maps HTTP 403 rate limit with headers to rate_limited error', async () => {
    const resetTimestamp = 1774300000;
    const rateLimitErr = {
      status: 403,
      message: 'API rate limit exceeded',
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': resetTimestamp.toString(),
        },
        data: { message: 'API rate limit exceeded' },
      },
    };

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn().mockRejectedValue(rateLimitErr),
        },
      },
    } as unknown as Octokit;

    const client = new GitHubClient({ octokit: mockOctokit });

    try {
      await client.fetchRepository('facebook', 'react');
    } catch (err) {
      const apiErr = err as GitHubApiError;
      expect(apiErr.kind).toBe('rate_limited');
      expect(apiErr.status).toBe(403);
      expect(apiErr.rateLimitReset).toBeDefined();
    }
  });

  it('maps HTTP 401/403 private repository to unauthorized error', async () => {
    const privateErr = {
      status: 401,
      message: 'Bad credentials',
      response: {
        headers: { 'x-ratelimit-remaining': '50' },
        data: { message: 'Must authenticate to access this private repository' },
      },
    };

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn().mockRejectedValue(privateErr),
        },
      },
    } as unknown as Octokit;

    const client = new GitHubClient({ octokit: mockOctokit });

    try {
      await client.fetchRepository('secret-org', 'private-repo');
    } catch (err) {
      const apiErr = err as GitHubApiError;
      expect(apiErr.kind).toBe('unauthorized');
      expect(apiErr.status).toBe(401);
      expect(apiErr.message).toContain('restricted or private');
    }
  });

  it('maps HTTP 500/503 to github_unavailable error', async () => {
    const serverErr = {
      status: 503,
      message: 'Service Unavailable',
    };

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn().mockRejectedValue(serverErr),
        },
      },
    } as unknown as Octokit;

    const client = new GitHubClient({ octokit: mockOctokit });

    try {
      await client.fetchRepository('facebook', 'react');
    } catch (err) {
      const apiErr = err as GitHubApiError;
      expect(apiErr.kind).toBe('github_unavailable');
      expect(apiErr.status).toBe(503);
    }
  });

  it('maps fetch / network errors to network_error', async () => {
    const netErr = new TypeError('Failed to fetch (ENOTFOUND)');

    const mockOctokit = {
      rest: {
        repos: {
          get: vi.fn().mockRejectedValue(netErr),
        },
      },
    } as unknown as Octokit;

    const client = new GitHubClient({ octokit: mockOctokit });

    try {
      await client.fetchRepository('facebook', 'react');
    } catch (err) {
      const apiErr = err as GitHubApiError;
      expect(apiErr.kind).toBe('network_error');
    }
  });
});
