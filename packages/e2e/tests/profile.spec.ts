import { expect, test } from '@playwright/test'

async function setupAuthAndMocks(page: any) {
  // 1. Inject localStorage BEFORE any JS runs (Force EN locale and set auth)
  await page.addInitScript(() => {
    localStorage.setItem('locale', 'en')
    localStorage.setItem('auth_token', 'oat_mock_token_123456')
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 1,
        fullName: 'E2E User',
        email: 'e2e@nexquery.ai',
        twoFactorEnabled: false,
      }),
    )
  })

  // 2. Smart Infrastructure Catch-all (Precise Matching)
  await page.route('**/api/**', async (route: any) => {
    const url = route.request().url()
    const ok = (json: any) => route.fulfill({ status: 200, json })

    if (url.match(/\/api\/settings($|\?)/)) {
      return ok([
        { key: 'require_2fa', value: 'false' },
        { key: 'platform_name', value: 'NexQuery' },
      ])
    }
    if (url.match(/\/api\/me($|\?)/)) {
      return ok({
        user: {
          id: 1,
          fullName: 'E2E User',
          email: 'e2e@nexquery.ai',
          twoFactorEnabled: false,
        },
        permissions: ['view_dashboard', 'manage_tasks', 'view_profile'],
      })
    }
    if (url.match(/\/api\/menus\/public($|\?)/)) {
      return ok([
        {
          id: 1,
          title: 'Dashboard',
          path: '/',
          icon: 'LayoutDashboard',
          component: 'pages/dashboard/index.vue',
          parentId: null,
          isActive: true,
        },
        {
          id: 2,
          title: 'Query Tasks',
          path: '/query-tasks',
          icon: 'FileCode',
          component: 'pages/query-tasks/index.vue',
          parentId: null,
          isActive: true,
        },
        {
          id: 10,
          title: 'Profile',
          path: '/profile',
          icon: 'User',
          component: 'pages/profile/index.vue',
          parentId: null,
          isActive: true,
        },
      ])
    }
    if (url.match(/\/api\/menus\/route-permissions($|\?)/)) {
      return ok({
        '/': 'view_dashboard',
        '/query-tasks': 'manage_tasks',
        '/profile': 'view_profile',
      })
    }
    if (url.match(/\/api\/notifications\/stream($|\?)/)) {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'data: []\n\n',
      })
    }
    return ok({})
  })
}

test('profile loads and can initiate 2FA setup', async ({ page }) => {
  await setupAuthAndMocks(page)

  await page.route('**/api/auth/2fa/generate', async (route) => {
    await route.fulfill({
      json: {
        qrCode:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        secret: 'MOCKSECRET123',
      },
    })
  })

  await page.goto('/profile')

  await expect(page.getByLabel('Full Name')).toHaveValue('E2E User')
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(
    'e2e@nexquery.ai',
  )

  const enableBtn = page.getByRole('button', { name: /Enable 2FA/i })
  await expect(enableBtn).toBeVisible()
  await enableBtn.click()

  await expect(page.getByText(/Scan the QR code/i)).toBeVisible()
  // Corrected alt text to match profile/index.vue
  await expect(page.locator('img[alt="2FA QR Code"]')).toBeVisible()
})
