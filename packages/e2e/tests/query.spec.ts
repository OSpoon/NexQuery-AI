import { expect, test } from '@playwright/test'

test('navigate to query tasks', async ({ page }) => {
  await page.goto('/')
  // Click on "Query Tasks" in the sidebar
  await page.getByRole('link', { name: 'Query Tasks' }).click()

  await expect(page).toHaveURL(/\/query-tasks/)
  await expect(page.getByRole('heading', { name: 'Query Tasks' })).toBeVisible()
})
