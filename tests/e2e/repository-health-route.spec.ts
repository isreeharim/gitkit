import { test, expect } from '@playwright/test';

test.describe('GitKit Repository Health (/{owner}/{repo}/health)', () => {
  test('renders health assessment for valid repository', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/health');

    if (response?.status() === 200) {
      await expect(page).toHaveTitle(/Repository Health:.*GitKit/i);

      // Verify header navigation
      const overviewLink = page.getByRole('link', { name: /Overview/i });
      await expect(overviewLink).toBeVisible();

      // Verify page headings and elements
      await expect(page.getByText('Deterministic Scoring Methodology')).toBeVisible();
      await expect(page.getByText('Repository Health Assessment')).toBeVisible();
      await expect(page.getByText('Composite Health Index')).toBeVisible();
      await expect(page.getByText('Category Score Breakdown')).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('renders 404 for invalid repository coordinates on health route', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/repo/health');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid GitHub owner/i)).toBeVisible();
  });

  test('navigates from repository overview page to health route', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      const healthBtn = page.getByRole('link', { name: /Health/i }).first();
      await expect(healthBtn).toBeVisible();
      await healthBtn.click();

      await expect(page).toHaveURL('/octocat/Hello-World/health');
      await expect(page.getByText('Repository Health Assessment')).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
