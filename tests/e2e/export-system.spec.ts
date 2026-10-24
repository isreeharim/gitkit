import { test, expect } from '@playwright/test';

test.describe('GitKit Export System', () => {
  test('opens export dialog and switches formats on repository map view', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World/map');

    if (response?.status() === 200) {
      // Wait for React Flow hydration
      await expect(page.locator('.react-flow__node').first()).toBeVisible();

      // Find export button in toolbar
      const exportBtn = page.getByRole('button', { name: /Export/i });
      await expect(exportBtn).toBeVisible();
      await exportBtn.click();

      // Verify dialog is open
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Export GitKit Analysis' })).toBeVisible();

      // Check format options
      await expect(page.getByRole('button', { name: 'SVG Vector' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'PNG Raster' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Mermaid .mmd' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'JSON Schema v1.0' })).toBeVisible();

      // Verify pre-filled filename
      const filenameInput = page.getByPlaceholder('Enter filename...');
      await expect(filenameInput).toBeVisible();
      await expect(filenameInput).toHaveValue(/gitkit-octocat-hello-world-repomap\.svg/i);

      // Switch to Mermaid format
      await page.getByRole('button', { name: 'Mermaid .mmd' }).click();
      await expect(filenameInput).toHaveValue(/gitkit-octocat-hello-world-repomap\.mmd/i);
      await expect(page.locator('pre code')).toContainText('flowchart TD');
      await expect(page.getByRole('button', { name: /Copy snippet/i })).toBeVisible();

      // Switch to JSON format
      await page.getByRole('button', { name: 'JSON Schema v1.0' }).click();
      await expect(filenameInput).toHaveValue(/gitkit-octocat-hello-world-repomap\.json/i);
      await expect(page.locator('pre code')).toContainText('"version": "1.0"');

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
      await expect(page.getByRole('heading', { name: /Rate Limit/i })).toBeVisible();
    }
  });

  test('provides export control on repository overview page', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      // Wait for React island hydration
      await page.waitForSelector('button[data-export-control="true"][data-hydrated="true"]');
      const exportBtn = page.locator('button[data-export-control="true"]').first();
      await expect(exportBtn).toBeVisible();
      await exportBtn.click();

      // Verify dialog opened on overview page
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Export GitKit Analysis' })).toBeVisible();

      // Close modal
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
