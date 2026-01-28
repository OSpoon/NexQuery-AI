import { expect, test } from '@playwright/test'

test('profile loads and can initiate 2FA setup', async ({ page }) => {
  // Mock User Data
  await page.route('/api/me', async (route) => {
    await route.fulfill({
      json: {
        user: {
          id: 1,
          email: 'e2e@nexquery.ai',
          fullName: 'E2E User',
          twoFactorEnabled: false,
          createdAt: new Date().toISOString(),
          lastPasswordChangeAt: new Date().toISOString(),
        },
      },
    })
  })

  // Mock 2FA Generate
  await page.route('/api/auth/2fa/generate', async (route) => {
    await route.fulfill({
      json: {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    })
  })

  await page.goto('/profile')

  // Verify User Info
  await expect(page.locator('input[disabled]').nth(0)).toHaveValue('E2E User')
  await expect(page.locator('input[disabled]').nth(1)).toHaveValue('e2e@nexquery.ai')

  // Click Enable 2FA
  await page.getByRole('button', { name: 'Enable 2FA' }).click()

  // Verify Dialog opens
  await expect(page.getByText('Enable User 2FA')).toBeVisible()

  // Verify QR Code image is present
  await expect(page.locator('img[alt="2FA QR Code"]')).toBeVisible()

  // Verify Input OTP is present
  await expect(page.locator('input[autocomplete="one-time-code"]')).toBeVisible()
})
