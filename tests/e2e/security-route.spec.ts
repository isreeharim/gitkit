import { test, expect } from '@playwright/test';

test.describe('GitKit Security Audit (/{owner}/{repo}/security)', () => {
  test('renders security audit workspace for valid repository', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/security');

    if (response?.status() === 200) {
      await expect(page).toHaveTitle(/Security Audit:.*GitKit/i);

      // Verify header navigation
      const overviewLink = page.getByRole('link', { name: /Overview/i });
      await expect(overviewLink).toBeVisible();

      // Verify page headings and elements
      await expect(page.getByText('Deterministic Security Analysis')).toBeVisible();
      await expect(page.getByText('Security Inspection & Advisory')).toBeVisible();
      await expect(page.getByText('Findings Detected', { exact: true })).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('renders 404 for invalid repository coordinates on security route', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/repo/security');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid GitHub owner/i)).toBeVisible();
  });

  test('navigates from repository overview page to security route', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      const securityBtn = page.getByRole('link', { name: /Security/i }).first();
      await expect(securityBtn).toBeVisible();
      await securityBtn.click();

      await expect(page).toHaveURL('/octocat/Hello-World/security');
      await expect(page.getByText('Security Inspection & Advisory')).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
