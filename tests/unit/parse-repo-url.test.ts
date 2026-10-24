import { describe, it, expect } from 'vitest';
import { parseGitHubRepoUrl, validateRepoCoordinates } from '@/lib/github/parse-repo-url';

describe('parseGitHubRepoUrl', () => {
  describe('Valid GitHub URL variations', () => {
    it('parses standard https://github.com/owner/repo', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.normalizedUrl).toBe('https://github.com/facebook/react');
        expect(res.data.gitkitRoute).toBe('/facebook/react');
        expect(res.data.subpath).toBeUndefined();
      }
    });

    it('parses URL with trailing slash', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react/');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.normalizedUrl).toBe('https://github.com/facebook/react');
      }
    });

    it('parses URL with .git suffix', () => {
      const res = parseGitHubRepoUrl('https://github.com/torvalds/linux.git');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('torvalds');
        expect(res.data.repo).toBe('linux');
      }
    });

    it('parses URL with .git suffix AND trailing slash', () => {
      const res = parseGitHubRepoUrl('https://github.com/torvalds/linux.git/');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('torvalds');
        expect(res.data.repo).toBe('linux');
      }
    });

    it('parses www.github.com domain', () => {
      const res = parseGitHubRepoUrl('https://www.github.com/facebook/react');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
      }
    });

    it('parses http protocol', () => {
      const res = parseGitHubRepoUrl('http://github.com/facebook/react');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
      }
    });

    it('parses URL without protocol starting with github.com', () => {
      const res = parseGitHubRepoUrl('github.com/astral-sh/uv');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('astral-sh');
        expect(res.data.repo).toBe('uv');
      }
    });

    it('parses URL without protocol starting with www.github.com', () => {
      const res = parseGitHubRepoUrl('www.github.com/astral-sh/uv');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('astral-sh');
        expect(res.data.repo).toBe('uv');
      }
    });

    it('parses bare owner/repo format', () => {
      const res = parseGitHubRepoUrl('withastro/astro');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('withastro');
        expect(res.data.repo).toBe('astro');
        expect(res.data.gitkitRoute).toBe('/withastro/astro');
      }
    });

    it('parses SSH git@github.com format', () => {
      const res = parseGitHubRepoUrl('git@github.com:torvalds/linux.git');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('torvalds');
        expect(res.data.repo).toBe('linux');
      }
    });
  });

  describe('Character naming rules', () => {
    it('parses repository names containing dots (e.g. next.js)', () => {
      const res = parseGitHubRepoUrl('https://github.com/vercel/next.js');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('vercel');
        expect(res.data.repo).toBe('next.js');
        expect(res.data.gitkitRoute).toBe('/vercel/next.js');
      }
    });

    it('parses repository names containing hyphens', () => {
      const res = parseGitHubRepoUrl('astral-sh/ruff-lsp');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('astral-sh');
        expect(res.data.repo).toBe('ruff-lsp');
      }
    });

    it('parses repository names containing underscores', () => {
      const res = parseGitHubRepoUrl('my-org/my_custom_repo');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('my-org');
        expect(res.data.repo).toBe('my_custom_repo');
      }
    });
  });

  describe('GitHub subpaths extraction', () => {
    it('handles /issues subpath and extracts owner/repo', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react/issues');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.subpath).toBe('issues');
      }
    });

    it('handles /pulls subpath with specific PR number', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react/pulls/1234');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.subpath).toBe('pulls/1234');
      }
    });

    it('handles /tree/main branch subpath', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react/tree/main/packages/react');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.subpath).toBe('tree/main/packages/react');
      }
    });

    it('handles /blob/main file subpath', () => {
      const res = parseGitHubRepoUrl(
        'https://github.com/facebook/react/blob/main/packages/react/index.js'
      );
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.subpath).toBe('blob/main/packages/react/index.js');
      }
    });

    it('handles /commit/... subpath', () => {
      const res = parseGitHubRepoUrl(
        'https://github.com/facebook/react/commit/d2b56e6d5e7d56a29ab26e4e37ac20a9a8d9a4b8'
      );
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.subpath).toBe('commit/d2b56e6d5e7d56a29ab26e4e37ac20a9a8d9a4b8');
      }
    });

    it('handles /releases subpath', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react/releases/tag/v18.2.0');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.subpath).toBe('releases/tag/v18.2.0');
      }
    });

    it('handles /actions subpath', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react/actions');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.subpath).toBe('actions');
      }
    });
  });

  describe('Query strings and URL fragments', () => {
    it('handles query strings', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react?tab=readme-ov-file');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
        expect(res.data.normalizedUrl).toBe('https://github.com/facebook/react');
      }
    });

    it('handles fragments (#)', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react#readme');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
      }
    });

    it('handles both query string and fragment simultaneously', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook/react?tab=readme#license');
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.owner).toBe('facebook');
        expect(res.data.repo).toBe('react');
      }
    });
  });

  describe('Invalid inputs and error handling', () => {
    it('rejects empty input or whitespace', () => {
      const res = parseGitHubRepoUrl('   ');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/cannot be empty|Please enter a GitHub repository/i);
      }
    });

    it('rejects unsupported domains (gitlab.com)', () => {
      const res = parseGitHubRepoUrl('https://gitlab.com/owner/repo');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Invalid domain');
      }
    });

    it('rejects unsupported domain without protocol (bitbucket.org/owner/repo)', () => {
      const res = parseGitHubRepoUrl('bitbucket.org/owner/repo');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Invalid domain');
      }
    });

    it('rejects unsupported protocols (e.g. ftp://)', () => {
      const res = parseGitHubRepoUrl('ftp://github.com/owner/repo');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toContain('Unsupported protocol');
      }
    });

    it('rejects missing owner (https://github.com/)', () => {
      const res = parseGitHubRepoUrl('https://github.com/');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Missing repository owner/i);
      }
    });

    it('rejects missing repository name (https://github.com/facebook)', () => {
      const res = parseGitHubRepoUrl('https://github.com/facebook');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Missing repository name/i);
      }
    });

    it('rejects single segment input without slash', () => {
      const res = parseGitHubRepoUrl('facebook');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Missing repository name/i);
      }
    });

    it('rejects reserved GitHub root paths as owner', () => {
      const res = parseGitHubRepoUrl('https://github.com/settings/profile');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/reserved GitHub system path/i);
      }
    });

    it('rejects invalid owner names starting with hyphen', () => {
      const res = parseGitHubRepoUrl('-invalid/my-repo');
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error).toMatch(/Invalid GitHub owner/i);
      }
    });

    it('rejects invalid repository name "." or ".."', () => {
      const res = parseGitHubRepoUrl('facebook/.');
      expect(res.success).toBe(false);
    });
  });
});

describe('validateRepoCoordinates', () => {
  it('validates good coordinates', () => {
    expect(validateRepoCoordinates('facebook', 'react').isValid).toBe(true);
    expect(validateRepoCoordinates('vercel', 'next.js').isValid).toBe(true);
    expect(validateRepoCoordinates('astral-sh', 'uv').isValid).toBe(true);
  });

  it('rejects empty or missing parameters', () => {
    expect(validateRepoCoordinates('', 'react').isValid).toBe(false);
    expect(validateRepoCoordinates('facebook', '').isValid).toBe(false);
  });

  it('rejects reserved root paths', () => {
    expect(validateRepoCoordinates('explore', 'trending').isValid).toBe(false);
    expect(validateRepoCoordinates('marketplace', 'app').isValid).toBe(false);
  });
});
