import { describe, it, expect, vi } from 'vitest';
import {
  normalizeRepositoryMetadata,
  normalizeRepositoryTree,
  RepositoryService,
} from '@/lib/github/service';
import {
  GitHubApiError,
  type IGitHubClient,
  type RawGitHubRepository,
  type RawGitHubTree,
} from '@/lib/github/client';

describe('normalizeRepositoryMetadata', () => {
  const sampleRawRepo: RawGitHubRepository = {
    id: 10270250,
    name: 'react',
    full_name: 'facebook/react',
    private: false,
    visibility: 'public',
    html_url: 'https://github.com/facebook/react',
    description: 'The library for web and native user interfaces.',
    fork: false,
    archived: false,
    created_at: '2013-05-24T16:15:54Z',
    updated_at: '2026-03-01T12:00:00Z',
    pushed_at: '2026-03-01T12:00:00Z',
    size: 320500,
    stargazers_count: 228000,
    watchers_count: 228000,
    forks_count: 46000,
    open_issues_count: 1050,
    language: 'JavaScript',
    default_branch: 'main',
    topics: ['declarative', 'frontend', 'javascript', 'react', 'ui'],
    homepage: 'https://react.dev',
    owner: {
      login: 'facebook',
      avatar_url: 'https://avatars.githubusercontent.com/u/69631?v=4',
    },
    license: {
      key: 'mit',
      name: 'MIT License',
      spdx_id: 'MIT',
      url: 'https://api.github.com/licenses/mit',
    },
  };

  it('normalizes raw GitHub payload into typed RepositoryMetadata', () => {
    const meta = normalizeRepositoryMetadata(sampleRawRepo);

    expect(meta.owner).toBe('facebook');
    expect(meta.name).toBe('react');
    expect(meta.fullName).toBe('facebook/react');
    expect(meta.description).toBe('The library for web and native user interfaces.');
    expect(meta.htmlUrl).toBe('https://github.com/facebook/react');
    expect(meta.defaultBranch).toBe('main');
    expect(meta.visibility).toBe('public');
    expect(meta.isFork).toBe(false);
    expect(meta.isArchived).toBe(false);
    expect(meta.stars).toBe(228000);
    expect(meta.forks).toBe(46000);
    expect(meta.language).toBe('JavaScript');
    expect(meta.license?.spdxId).toBe('MIT');
    expect(meta.license?.name).toBe('MIT License');
    expect(meta.topics).toHaveLength(5);
    expect(meta.sizeKb).toBe(320500);
  });

  it('handles nullable description, license, and language gracefully', () => {
    const minimalRaw = {
      ...sampleRawRepo,
      description: null,
      license: null,
      language: null,
      topics: undefined,
    };

    const meta = normalizeRepositoryMetadata(minimalRaw);

    expect(meta.description).toBeNull();
    expect(meta.license).toBeNull();
    expect(meta.language).toBeNull();
    expect(meta.topics).toEqual([]);
  });

  it('marks private visibility correctly', () => {
    const privateRaw = {
      ...sampleRawRepo,
      private: true,
    };

    const meta = normalizeRepositoryMetadata(privateRaw);
    expect(meta.visibility).toBe('private');
  });
});

describe('normalizeRepositoryTree', () => {
  const sampleRawTree: RawGitHubTree = {
    sha: 'tree-sha-root',
    url: 'https://api.github.com/trees/tree-sha-root',
    truncated: false,
    tree: [
      { path: 'src', mode: '040000', type: 'tree', sha: 'sha-dir-src' },
      { path: 'src/index.ts', mode: '100644', type: 'blob', size: 1024, sha: 'sha-file-1' },
      { path: 'src/utils.ts', mode: '100644', type: 'blob', size: 2048, sha: 'sha-file-2' },
      { path: 'docs', mode: '040000', type: 'tree', sha: 'sha-dir-docs' },
      { path: 'README.md', mode: '100644', type: 'blob', size: 512, sha: 'sha-file-3' },
      { path: 'vendor/sub', mode: '160000', type: 'commit', sha: 'sha-submodule' },
    ],
  };

  it('computes total files, directories, and byte size', () => {
    const tree = normalizeRepositoryTree(sampleRawTree);

    expect(tree.sha).toBe('tree-sha-root');
    expect(tree.truncated).toBe(false);
    expect(tree.totalFiles).toBe(3); // 3 blobs
    expect(tree.totalDirectories).toBe(2); // 2 trees
    expect(tree.totalBytes).toBe(1024 + 2048 + 512); // 3584
    expect(tree.entries).toHaveLength(6);
  });

  it('sorts directories first, then alphabetically by path', () => {
    const tree = normalizeRepositoryTree(sampleRawTree);

    // The first 2 items must be the directories: 'docs' and 'src'
    expect(tree.entries[0].type).toBe('tree');
    expect(tree.entries[0].path).toBe('docs');
    expect(tree.entries[1].type).toBe('tree');
    expect(tree.entries[1].path).toBe('src');

    // Followed by blobs and other items sorted alphabetically
    const nonDirs = tree.entries.slice(2);
    expect(nonDirs.map((e) => e.path)).toEqual([
      'README.md',
      'src/index.ts',
      'src/utils.ts',
      'vendor/sub',
    ]);
  });

  it('correctly classifies submodule type', () => {
    const tree = normalizeRepositoryTree(sampleRawTree);
    const submodule = tree.entries.find((e) => e.path === 'vendor/sub');
    expect(submodule?.type).toBe('submodule');
  });

  it('handles truncated trees', () => {
    const truncatedRaw: RawGitHubTree = {
      ...sampleRawTree,
      truncated: true,
    };

    const tree = normalizeRepositoryTree(truncatedRaw);
    expect(tree.truncated).toBe(true);
  });

  it('safely caps giant trees to maxEntries while preserving total file counts', () => {
    const bigEntries = Array.from({ length: 50 }, (_, i) => ({
      path: `dir/file-${i}.ts`,
      mode: '100644',
      type: 'blob',
      size: 100,
      sha: `sha-${i}`,
    }));

    const bigTreeRaw: RawGitHubTree = {
      sha: 'big-sha',
      url: 'https://api.github.com/trees/big-sha',
      truncated: false,
      tree: [
        { path: 'package.json', mode: '100644', type: 'blob', size: 200, sha: 'pkg-sha' },
        ...bigEntries,
      ],
    };

    // Cap at 10 items
    const tree = normalizeRepositoryTree(bigTreeRaw, 10);
    expect(tree.totalFiles).toBe(51);
    expect(tree.entries.length).toBe(10);
    expect(tree.truncated).toBe(true);
    // Prioritizes package.json
    expect(tree.entries.some((e) => e.path === 'package.json')).toBe(true);
  });
});

describe('RepositoryService', () => {
  it('successfully ingests a public repository and its tree', async () => {
    const mockClient: IGitHubClient = {
      fetchRepository: vi.fn().mockResolvedValue({
        name: 'react',
        full_name: 'facebook/react',
        private: false,
        html_url: 'https://github.com/facebook/react',
        description: 'React library',
        fork: false,
        archived: false,
        created_at: '2013-05-24T16:15:54Z',
        updated_at: '2026-03-01T12:00:00Z',
        pushed_at: '2026-03-01T12:00:00Z',
        size: 5000,
        stargazers_count: 100,
        watchers_count: 100,
        forks_count: 10,
        open_issues_count: 5,
        language: 'TypeScript',
        default_branch: 'main',
        owner: { login: 'facebook' },
        license: null,
      }),
      fetchTree: vi.fn().mockResolvedValue({
        sha: 'main-sha',
        url: '...',
        truncated: false,
        tree: [{ path: 'README.md', mode: '100644', type: 'blob', size: 100, sha: 'abc' }],
      }),
      fetchBlobContent: vi.fn(),
      fetchFileContent: vi.fn(),
    };

    const service = new RepositoryService(mockClient);
    const result = await service.ingestRepository('facebook', 'react');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.metadata.name).toBe('react');
      expect(result.metadata.owner).toBe('facebook');
      expect(result.tree.totalFiles).toBe(1);
      expect(result.tree.entries[0].path).toBe('README.md');
    }
  });

  it('rejects private repositories with unauthorized error', async () => {
    const mockClient: IGitHubClient = {
      fetchRepository: vi.fn().mockResolvedValue({
        name: 'secret',
        full_name: 'corp/secret',
        private: true,
        owner: { login: 'corp' },
      }),
      fetchTree: vi.fn(),
      fetchBlobContent: vi.fn(),
      fetchFileContent: vi.fn(),
    };

    const service = new RepositoryService(mockClient);
    const result = await service.ingestRepository('corp', 'secret');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.kind).toBe('unauthorized');
      expect(result.error.status).toBe(403);
      expect(result.error.message).toContain('private');
    }
  });

  it('handles empty repositories without tree gracefully', async () => {
    const mockClient: IGitHubClient = {
      fetchRepository: vi.fn().mockResolvedValue({
        name: 'empty-repo',
        full_name: 'user/empty-repo',
        private: false,
        default_branch: 'main',
        owner: { login: 'user' },
      }),
      fetchTree: vi
        .fn()
        .mockRejectedValue(new GitHubApiError('Git Tree not found', 'not_found', 404)),
      fetchBlobContent: vi.fn(),
      fetchFileContent: vi.fn(),
    };

    const service = new RepositoryService(mockClient);
    const result = await service.ingestRepository('user', 'empty-repo');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.tree.entries).toEqual([]);
      expect(result.tree.totalFiles).toBe(0);
    }
  });

  it('propagates GitHubApiError correctly', async () => {
    const mockClient: IGitHubClient = {
      fetchRepository: vi.fn().mockRejectedValue(new GitHubApiError('Not Found', 'not_found', 404)),
      fetchTree: vi.fn(),
      fetchBlobContent: vi.fn(),
      fetchFileContent: vi.fn(),
    };

    const service = new RepositoryService(mockClient);
    const result = await service.ingestRepository('facebook', 'nonexistent');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.kind).toBe('not_found');
      expect(result.error.status).toBe(404);
    }
  });
});
