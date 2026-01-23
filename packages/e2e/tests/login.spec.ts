import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } }); // Reset storage state for this file

test('has title', async ({ page }) => {
    await page.goto('/login');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/NexQuery/);
});

test('login form is visible', async ({ page }) => {
    await page.goto('/login');
    // Use IDs as we confirmed they work in auth.setup.ts
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
});
