import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the main heading', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: /whitepaper xbrl/i })).toBeVisible();
  });

  test('should display the upload area', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/drop your pdf here/i)).toBeVisible();
  });

  test('should display all three token types', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('OTHR')).toBeVisible();
    await expect(page.getByText('ART')).toBeVisible();
    await expect(page.getByText('EMT')).toBeVisible();
  });

  test('should display feature cards', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/smart extraction/i)).toBeVisible();
    await expect(page.getByText(/full validation/i)).toBeVisible();
    await expect(page.getByText(/instant download/i)).toBeVisible();
  });

  test('should display compliance badge', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/esma mica taxonomy/i)).toBeVisible();
  });
});
