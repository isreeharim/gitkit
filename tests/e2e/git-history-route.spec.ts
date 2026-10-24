import { test, expect } from '@playwright/test';

test.describe('GitKit Git History & Hotspots (/{owner}/{repo}/git)', () => {
  test('renders git history workspace for valid repository', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/git');

    if (response?.status() === 200) {
      await expect(page).toHaveTitle(/Git History.*GitKit/i);

      // Verify header navigation
      const overviewLink = page.getByRole('link', { name: /Overview/i });
      await expect(overviewLink).toBeVisible();

      // Verify summary cards
      await expect(page.getByText('Commits Analyzed')).toBeVisible();
      await expect(page.getByText('Net Growth')).toBeVisible();
      await expect(page.getByText('Active Authors')).toBeVisible();
      await expect(page.getByText('Hotspots Identified')).toBeVisible();

      // Verify Hotspots table section
      await expect(page.getByText(/Code Hotspots & Churn Velocity/i)).toBeVisible();
      await expect(page.getByText(/Methodology:/i)).toBeVisible();

      // Verify Activity timeline chart section
      await expect(page.getByText(/Commit Velocity & Code Volume Over Time/i)).toBeVisible();

      // Verify Commit timeline feed
      await expect(page.getByText(/Commit Timeline & Recent Changes/i)).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('renders 404 for invalid repository coordinates on git route', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/repo/git');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid GitHub owner/i)).toBeVisible();
  });

  test('navigates from repository overview page to git history route', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      const gitBtn = page.getByRole('link', { name: /Git History/i }).first();
      await expect(gitBtn).toBeVisible();
      await gitBtn.click();

      await expect(page).toHaveURL('/octocat/Hello-World/git');
      await expect(page.getByText('Commits Analyzed')).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
