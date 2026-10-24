import { test, expect } from '@playwright/test';

test.describe('GitKit Unified Repository Workspace (Phase 11)', () => {
  test('renders unified repository workspace header and navigation tabs', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      // 1. Verify Header identity & breadcrumbs
      const navHeader = page.locator('header').filter({ hasText: 'octocat' });
      await expect(navHeader).toBeVisible();
      await expect(page.getByRole('link', { name: 'octocat' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Hello-World' })).toBeVisible();

      // 2. Verify navigation container
      const nav = page.getByRole('navigation', { name: 'Repository navigation' });
      await expect(nav).toBeVisible();

      // 3. Verify all 7 navigation tabs are present as semantic links
      const overviewTab = nav.getByRole('link', { name: /^Overview/ });
      const mapTab = nav.getByRole('link', { name: /^Map/ });
      const depsTab = nav.getByRole('link', { name: /^Dependencies/ });
      const gitTab = nav.getByRole('link', { name: /^Git/ });
      const pullsTab = nav.getByRole('link', { name: /^Pull Requests/ });
      const healthTab = nav.getByRole('link', { name: /^Health/ });
      const securityTab = nav.getByRole('link', { name: /^Security/ });

      await expect(overviewTab).toBeVisible();
      await expect(mapTab).toBeVisible();
      await expect(depsTab).toBeVisible();
      await expect(gitTab).toBeVisible();
      await expect(pullsTab).toBeVisible();
      await expect(healthTab).toBeVisible();
      await expect(securityTab).toBeVisible();

      // 4. Verify Overview is active by default
      await expect(overviewTab).toHaveAttribute('aria-current', 'page');
      await expect(mapTab).not.toHaveAttribute('aria-current');

      // 5. Verify Overview Executive Summary Cards
      await expect(page.getByRole('heading', { name: 'Repository Health' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Security Posture' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Recent Git Evolution' })).toBeVisible();
      await expect(
        page.getByRole('heading', { name: 'Repository Analysis Engines' })
      ).toBeVisible();

      // 6. Verify Export control trigger is rendered
      const exportBtn = page.locator('button[data-export-control="true"]').first();
      await expect(exportBtn).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('navigates seamlessly across workspace sections via primary tabs', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      const nav = page.getByRole('navigation', { name: 'Repository navigation' });

      // Click Map tab
      await nav.getByRole('link', { name: /^Map/ }).click();
      await expect(page).toHaveURL(/\/octocat\/Hello-World\/map/);
      await expect(
        page
          .getByRole('navigation', { name: 'Repository navigation' })
          .getByRole('link', { name: /^Map/ })
      ).toHaveAttribute('aria-current', 'page');

      // Click Dependencies tab
      await page
        .getByRole('navigation', { name: 'Repository navigation' })
        .getByRole('link', { name: /^Dependencies/ })
        .click();
      await expect(page).toHaveURL(/\/octocat\/Hello-World\/dependencies/);
      await expect(
        page
          .getByRole('navigation', { name: 'Repository navigation' })
          .getByRole('link', { name: /^Dependencies/ })
      ).toHaveAttribute('aria-current', 'page');

      // Click Health tab
      await page
        .getByRole('navigation', { name: 'Repository navigation' })
        .getByRole('link', { name: /^Health/ })
        .click();
      await expect(page).toHaveURL(/\/octocat\/Hello-World\/health/);
      await expect(
        page
          .getByRole('navigation', { name: 'Repository navigation' })
          .getByRole('link', { name: /^Health/ })
      ).toHaveAttribute('aria-current', 'page');

      // Click Security tab
      await page
        .getByRole('navigation', { name: 'Repository navigation' })
        .getByRole('link', { name: /^Security/ })
        .click();
      await expect(page).toHaveURL(/\/octocat\/Hello-World\/security/);
      await expect(
        page
          .getByRole('navigation', { name: 'Repository navigation' })
          .getByRole('link', { name: /^Security/ })
      ).toHaveAttribute('aria-current', 'page');

      // Return to Overview
      await page
        .getByRole('navigation', { name: 'Repository navigation' })
        .getByRole('link', { name: /^Overview/ })
        .click();
      await expect(page).toHaveURL(/\/octocat\/Hello-World/);
      await expect(
        page
          .getByRole('navigation', { name: 'Repository navigation' })
          .getByRole('link', { name: /^Overview/ })
      ).toHaveAttribute('aria-current', 'page');
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });

  test('supports URL state filter on Pull Requests tab', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/pulls?state=open');

    if (response?.status() === 200) {
      const nav = page.getByRole('navigation', { name: 'Repository navigation' });
      await expect(nav.getByRole('link', { name: /^Pull Requests/ })).toHaveAttribute(
        'aria-current',
        'page'
      );

      // Verify state filter links
      await expect(page.getByRole('link', { name: 'Open', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Closed', exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'All', exact: true })).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
