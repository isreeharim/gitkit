import { describe, it, expect } from 'vitest';
import { parseGitHubRepoUrl } from '@/lib/github/parse-repo-url';

describe('parseGitHubRepoUrl', () => {
  it('parses standard owner/repo format', () => {
    const res = parseGitHubRepoUrl('astral-sh/uv');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.coordinates.owner).toBe('astral-sh');
      expect(res.coordinates.repo).toBe('uv');
      expect(res.canonicalUrl).toBe('https://github.com/astral-sh/uv');
    }
  });

  it('parses https://github.com/owner/repo', () => {
    const res = parseGitHubRepoUrl('https://github.com/facebook/react');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.coordinates.owner).toBe('facebook');
      expect(res.coordinates.repo).toBe('react');
      expect(res.canonicalUrl).toBe('https://github.com/facebook/react');
    }
  });

  it('parses https URL with .git suffix and trailing slash', () => {
    const res = parseGitHubRepoUrl('https://github.com/torvalds/linux.git/');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.coordinates.owner).toBe('torvalds');
      expect(res.coordinates.repo).toBe('linux');
      expect(res.canonicalUrl).toBe('https://github.com/torvalds/linux');
    }
  });

  it('parses git@github.com SSH URLs', () => {
    const res = parseGitHubRepoUrl('git@github.com:withastro/astro.git');
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.coordinates.owner).toBe('withastro');
      expect(res.coordinates.repo).toBe('astro');
      expect(res.canonicalUrl).toBe('https://github.com/withastro/astro');
    }
  });

  it('rejects empty input', () => {
    const res = parseGitHubRepoUrl('   ');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('Please enter a GitHub repository');
    }
  });

  it('rejects single word string', () => {
    const res = parseGitHubRepoUrl('just-a-repo');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('Invalid format');
    }
  });

  it('rejects invalid owner names', () => {
    const res = parseGitHubRepoUrl('-invalid/my-repo');
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('Invalid GitHub owner');
    }
  });
});
