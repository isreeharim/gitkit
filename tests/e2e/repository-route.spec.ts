import { test, expect } from '@playwright/test';

test.describe('GitKit Repository Route (/{owner}/{repo})', () => {
  test('renders repository loading shell for valid repository coordinates', async ({ page }) => {
    const response = await page.goto('/facebook/react');
    expect(response?.status()).toBe(200);

    // Verify title & headings
    await expect(page).toHaveTitle(/facebook\/react/);
    await expect(page.locator('h1')).toContainText('facebook');
    await expect(page.locator('h1')).toContainText('react');

    // Verify status notices & badges
    await expect(page.getByText('Deterministic Route Validated')).toBeVisible();
    await expect(page.getByText('Loading repository information...')).toBeVisible();
    await expect(page.getByText(/Phase 1 Engine Active/i)).toBeVisible();

    // Verify GitHub external link
    const githubLink = page.getByRole('link', { name: 'GitHub' });
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute('href', 'https://github.com/facebook/react');
  });

  test('renders repository loading shell for repositories with dots (vercel/next.js)', async ({
    page,
  }) => {
    const response = await page.goto('/vercel/next.js');
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle(/vercel\/next\.js/);
    await expect(page.locator('h1')).toContainText('vercel');
    await expect(page.locator('h1')).toContainText('next.js');
  });

  test('renders 404 error state for invalid repository coordinates', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/my-repo');
    expect(response?.status()).toBe(404);

    await expect(page.getByRole('heading', { name: 'Repository Not Found' })).toBeVisible();
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
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toContainText('withastro');
    await expect(heading).toContainText('astro');
  });
});
