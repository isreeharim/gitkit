import { test, expect } from '@playwright/test';

test.describe('GitKit System Architecture Diagram (/{owner}/{repo}/diagram)', () => {
  test('renders architecture diagram page and navigation tab for valid repository', async ({
    page,
  }) => {
    const response = await page.goto('/octocat/Hello-World/diagram');

    if (response?.status() === 200) {
      await expect(page).toHaveTitle(/Architecture Diagram:.*GitKit/i);

      // Verify exact header Overview tab link
      const overviewLink = page
        .getByRole('navigation', { name: 'Repository navigation' })
        .getByRole('link', { name: /^Overview$/i });
      await expect(overviewLink).toBeVisible();

      // Check Diagram navigation tab is active
      const diagramTab = page
        .getByRole('navigation', { name: 'Repository navigation' })
        .getByRole('link', { name: /^Diagram/ });
      await expect(diagramTab).toBeVisible();
      await expect(diagramTab).toHaveAttribute('aria-current', 'page');

      // For repositories without source files (e.g. Hello-World), verify clean empty state
      const emptyStateHeading = page.getByRole('heading', {
        name: /No Architectural Subsystems Detected/i,
      });
      const toolbarTitle = page.getByText('System Architecture');

      const isCanvasRendered = await toolbarTitle.isVisible();
      if (isCanvasRendered) {
        await expect(toolbarTitle).toBeVisible();
        await expect(page.getByTitle('Zoom In (+)')).toBeVisible();
        await expect(page.getByTitle('Fit to Screen')).toBeVisible();
      } else {
        await expect(emptyStateHeading).toBeVisible();
        await expect(page.getByRole('link', { name: /Explore Repo Map/i })).toBeVisible();
      }
    } else {
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('renders 404 for invalid repository coordinates on diagram route', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/repo/diagram');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid GitHub owner/i)).toBeVisible();
  });
});
