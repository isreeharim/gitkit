import { test, expect } from '@playwright/test';

test.describe('GitKit Homepage', () => {
  test('renders homepage with technical branding and badges', async ({ page }) => {
    await page.goto('/');

    // Check title & branding
    await expect(page).toHaveTitle(/GitKit/);
    await expect(page.locator('h1')).toContainText('Understand. Analyze. Visualize.');

    // Check positioning badges
    await expect(page.getByText('Zero AI / Deterministic')).toBeVisible();
    await expect(page.getByText('₹0 Operating Budget')).toBeVisible();
  });

  test('validates repo input without mock results', async ({ page }) => {
    await page.goto('/');

    // Wait for React island to hydrate
    await page.waitForSelector('[data-hydrated="true"]');

    const input = page.getByRole('textbox', { name: 'GitHub Repository URL' });
    const submitBtn = page.locator('form').getByRole('button', { name: 'Inspect' });

    // Test invalid input
    await input.fill('invalid_repo_format');
    await submitBtn.click();
    await expect(page.getByText(/Invalid format\. Expected "owner\/repo"/i)).toBeVisible();

    // Test valid input
    await input.fill('https://github.com/astral-sh/uv');
    await submitBtn.click();
    await expect(page.getByText(/Valid repository target:/i)).toBeVisible();
    await expect(page.getByText('astral-sh/uv')).toBeVisible();
    await expect(page.getByText(/Phase 0 Status:/i)).toBeVisible();
  });
});
