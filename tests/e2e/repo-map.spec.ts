import { test, expect } from '@playwright/test';

test.describe('GitKit Interactive Repository Map (/{owner}/{repo}/map)', () => {
  test('renders full interactive repository map for valid repository', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/map');

    if (response?.status() === 200) {
      await expect(page).toHaveTitle(/Repo Map:.*GitKit/i);

      // Verify header breadcrumbs and overview back-link
      const overviewLink = page.getByRole('link', { name: /Overview/i });
      await expect(overviewLink).toBeVisible();

      // Verify React Flow canvas is rendered
      const reactFlowCanvas = page.locator('.react-flow');
      await expect(reactFlowCanvas).toBeVisible();

      // Verify interactive controls
      const controls = page.locator('.react-flow__controls');
      await expect(controls).toBeVisible();

      // Verify search input in toolbar
      const searchInput = page.getByPlaceholder('Search files or folders...');
      await expect(searchInput).toBeVisible();

      // Verify at least one node is rendered (root repo node)
      const nodes = page.locator('.react-flow__node');
      await expect(nodes.first()).toBeVisible();

      // Test searching in repository map
      await searchInput.fill('README');
      // Verify node highlighting or filtering maintains canvas
      await expect(reactFlowCanvas).toBeVisible();

      // Clear search
      await page.getByRole('button', { name: 'Clear search' }).click();
      await expect(searchInput).toHaveValue('');

      // Test clicking the first node to open detail inspector panel
      await nodes.first().click();
      const closeInspectorBtn = page.getByRole('button', { name: 'Close detail panel' });
      await expect(closeInspectorBtn).toBeVisible();

      // Close inspector
      await closeInspectorBtn.click();
      await expect(closeInspectorBtn).not.toBeVisible();
    } else {
      // Graceful GitHub rate-limit handling in unauthenticated CI
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('renders 404 for invalid repository coordinates on map route', async ({ page }) => {
    const response = await page.goto('/-invalid-owner/repo/map');
    expect(response?.status()).toBe(404);

    await expect(
      page.getByRole('heading', { name: 'Invalid Repository Coordinates' })
    ).toBeVisible();
    await expect(page.getByText(/Invalid GitHub owner/i)).toBeVisible();
  });

  test('navigates from repository overview page to repository map', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      const mapBtn = page.getByRole('link', { name: /Repo Map/i }).first();
      await expect(mapBtn).toBeVisible();
      await mapBtn.click();

      await expect(page).toHaveURL('/octocat/Hello-World/map');
      await expect(page.locator('.react-flow')).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
