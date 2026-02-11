import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the main heading', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /whitepaper xbrl/i })).toBeVisible();
  });

  test('should display the upload area', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/drop your whitepaper here/i)).toBeVisible();
  });

  test('should display all three token types', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('OTHR').first()).toBeVisible();
    await expect(page.getByText('ART').first()).toBeVisible();
    await expect(page.getByText('EMT').first()).toBeVisible();
  });

  test('should display feature cards', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /smart extraction/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /full validation/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /instant download/i })).toBeVisible();
  });

  test('should display compliance badge', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/esma mica taxonomy 2025-03-31/i)).toBeVisible();
  });
});
