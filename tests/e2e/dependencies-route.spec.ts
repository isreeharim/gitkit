import { test, expect } from '@playwright/test';

test.describe('GitKit Dependency Graph (/{owner}/{repo}/dependencies)', () => {
  test('renders full dependency graph workspace for valid repository', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/dependencies');

    if (response?.status() === 200) {
      await expect(page).toHaveTitle(/Dependencies:.*GitKit/i);

      // Verify header navigation
      const overviewLink = page.getByRole('link', { name: /Overview/i });
      await expect(overviewLink).toBeVisible();

      // Verify React Flow canvas
      const reactFlowCanvas = page.locator('.react-flow');
      await expect(reactFlowCanvas).toBeVisible();

      // Verify interactive controls
      const controls = page.locator('.react-flow__controls');
      await expect(controls).toBeVisible();

      // Verify search input
      const searchInput = page.getByPlaceholder('Search module or package...');
      await expect(searchInput).toBeVisible();

      // Verify filter pills
      await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Internal' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Packages' })).toBeVisible();

      // Verify stats bar exists
      await expect(page.getByText(/analyzed/i).first()).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('renders 404 for invalid repository coordinates on dependencies route', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/repo/dependencies');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid GitHub owner/i)).toBeVisible();
  });

  test('navigates from repository overview page to dependencies route', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      const depBtn = page.getByRole('link', { name: /Dependencies/i }).first();
      await expect(depBtn).toBeVisible();
      await depBtn.click();

      await expect(page).toHaveURL('/octocat/Hello-World/dependencies');
      await expect(page.locator('.react-flow')).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
