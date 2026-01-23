import { test, expect } from '@playwright/test';

test('dashboard loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/NexQuery/);

    // Wait for sidebar to be visible as a proxy for loaded dashboard
    // Using a generic structural check or looking for specific menu items
    // Since we know the sidebar has "Query Tasks" from query.spec.ts, let's use that
    // Or just check for the main layout container if it has a stable ID/Class
    await expect(page.locator('main')).toBeVisible();

    // Also check for the user navigation (usually top right)
    // await expect(page.locator('header')).toBeVisible(); 
});
