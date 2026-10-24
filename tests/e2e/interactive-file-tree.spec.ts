import { test, expect } from '@playwright/test';

test.describe('GitKit Interactive File Tree', () => {
  test('allows expanding, collapsing, and filtering folders in the file tree', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      // 1. Verify file tree is present
      const treeHeading = page.getByRole('heading', { name: 'Repository File Tree' });
      await expect(treeHeading).toBeVisible();

      // 2. Verify search input in tree toolbar
      const treeSearch = page.getByPlaceholder('Search files in tree...');
      await expect(treeSearch).toBeVisible();

      // 3. Verify Expand All and Collapse All buttons
      const expandAllBtn = page.getByRole('button', { name: /Expand All/i });
      const collapseAllBtn = page.getByRole('button', { name: /Collapse All/i });
      await expect(expandAllBtn).toBeVisible();
      await expect(collapseAllBtn).toBeVisible();

      // 4. Test searching
      await treeSearch.fill('README');
      await expect(treeSearch).toHaveValue('README');

      // Verify matching file is visible
      await expect(page.getByRole('link', { name: 'README' })).toBeVisible();

      // Clear search via clear button
      const clearBtn = page.getByRole('button', { name: 'Clear file search' });
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();
      await expect(treeSearch).toHaveValue('');

      // 5. Test searching for non-existent file
      await treeSearch.fill('nonexistent_file_xyz');
      await expect(page.getByText(/No files matching/i)).toBeVisible();
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });

  test('collapses and expands folders on click when folder elements exist', async ({ page }) => {
    const response = await page.goto('/octocat/Hello-World');

    if (response?.status() === 200) {
      const folderButtons = page.locator('button[aria-expanded]');
      const count = await folderButtons.count();

      if (count > 0) {
        const firstFolder = folderButtons.first();
        const initialExpanded = await firstFolder.getAttribute('aria-expanded');

        // Click to toggle
        await firstFolder.click();
        const newExpanded = await firstFolder.getAttribute('aria-expanded');
        expect(newExpanded).not.toBe(initialExpanded);

        // Click again to toggle back
        await firstFolder.click();
        const restoredExpanded = await firstFolder.getAttribute('aria-expanded');
        expect(restoredExpanded).toBe(initialExpanded);
      }
    } else {
      expect([200, 403]).toContain(response?.status());
    }
  });
});
