import { test, expect } from '@playwright/test';

test.describe('GitKit Repository Route (/{owner}/{repo})', () => {
  test('renders repository workspace and file tree for valid repository coordinates', async ({
    page,
  }) => {
    const response = await page.goto('/facebook/react');

    if (response?.status() === 200) {
      // Successful ingestion (GitHub responds with canonical repo metadata)
      await expect(page).toHaveTitle(/react.*GitKit/i);
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toContainText('react');

      // Verify file tree & live ingestion elements
      await expect(page.getByText('Live Ingestion Active')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Repository File Tree' })).toBeVisible();

      // Verify GitHub external link
      const githubLink = page.getByRole('link', { name: 'GitHub' });
      await expect(githubLink).toBeVisible();
    } else {
      // Rate limited in CI/sandbox without token
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByText(/GitHub API Rate Limit|Rate Limit/i)).toBeVisible();
    }
  });

  test('renders 404 error state for invalid repository coordinates', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/my-repo');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid GitHub owner/i)).toBeVisible();

    // Verify Return to Search button
    const returnLink = page.getByRole('link', { name: /Return to Search/i });
    await expect(returnLink).toBeVisible();
    await returnLink.click();
    await expect(page).toHaveURL('/');
  });

  test('navigates from homepage search to repository workspace', async ({ page }) => {
    await page.goto('/');

    await page.waitForSelector('[data-hydrated="true"]');
    const input = page.getByRole('textbox', { name: 'GitHub Repository URL' });
    const submitBtn = page.locator('form').getByRole('button', { name: 'Inspect' });

    await input.fill('https://github.com/withastro/astro');
    await submitBtn.click();

    const openWorkspaceBtn = page.getByRole('link', { name: 'Open Workspace' });
    await expect(openWorkspaceBtn).toBeVisible();
    await openWorkspaceBtn.click();

    await expect(page).toHaveURL('/withastro/astro');
  });
});
