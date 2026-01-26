import { expect, test as setup } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // Force English locale
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'en')
  })

  // Mock settings just in case
  await page.route('**/api/settings', async (route) => {
    try {
      const response = await route.fetch()
      const json = await response.json()
      const idx = json.findIndex((s: any) => s.key === 'require_2fa')
      if (idx >= 0) {
        json[idx].value = 'false'
      }
      else {
        json.push({ key: 'require_2fa', value: 'false' })
      }
      await route.fulfill({ json })
    }
    catch {
      await route.fulfill({ json: [{ key: 'require_2fa', value: 'false' }] })
    }
  })

  await page.goto('/login')
  await page.locator('#email').fill('e2e@nexquery.ai')
  await page.locator('#password').fill('password')
  await page.locator('button[type="submit"]').click()

  // Wait for a short time to let UI react
  await page.waitForTimeout(3000)

  // Check for 2FA input
  const otpInput = page.locator('input[autocomplete="one-time-code"]').first()
  const is2FaVisible = await otpInput.isVisible().catch(() => false)

  if (is2FaVisible) {
    console.error('DETECTED: 2FA Prompt is visible. Login stalled.')
    throw new Error('Login failed: User requires 2FA.')
  }

  // Check for error message (toast)
  const errorToast = page.locator('li[data-type="error"]')
  if (await errorToast.isVisible().catch(() => false)) {
    const errorText = await errorToast.textContent()
    console.error(`DETECTED: Error Toast: ${errorText}`)
    throw new Error(`Login failed with error: ${errorText}`)
  }

  // Check if password expired (redirected to change-password)
  if (page.url().includes('change-password')) {
    console.error('DETECTED: Redirected to Change Password page.')
    throw new Error('Login failed: Password expired.')
  }

  // Expect dashboard
  await expect(page).toHaveURL('/', { timeout: 10000 })
  await page.context().storageState({ path: authFile })
})
