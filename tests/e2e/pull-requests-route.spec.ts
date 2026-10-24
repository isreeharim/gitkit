import { test, expect } from '@playwright/test';

test.describe('GitKit Pull Requests (/{owner}/{repo}/pulls)', () => {
  test('renders pull requests list for valid repository', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/pulls');

    if (response?.status() === 200) {
      await expect(page).toHaveTitle(/Pull Requests:.*GitKit/i);

      // Verify header navigation
      const overviewLink = page.getByRole('link', { name: /Overview/i });
      await expect(overviewLink).toBeVisible();

      // Verify page content
      await expect(page.getByText('Public Pull Requests')).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('renders 404 for invalid repository coordinates on pulls route', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/repo/pulls');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid GitHub owner/i)).toBeVisible();
  });

  test('renders 404 for invalid pull request number on pulls/[number] route', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/pulls/invalid-number');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid pull request number/i)).toBeVisible();
  });

  test('navigates from repository overview page to pull requests route', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      const pullsBtn = page.getByRole('link', { name: /Pull Requests/i }).first();
      await expect(pullsBtn).toBeVisible();
      await pullsBtn.click();

      await expect(page).toHaveURL('/octocat/Hello-World/pulls');
      await expect(page.getByText('Public Pull Requests')).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
