import { expect, test as setup } from '@playwright/test'

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  // 1. Mock necessary infrastructure
  await page.route('**/api/**', async (route) => {
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

  // 2. Initial visit
  await page.goto('/login')

  // 3. Set storage
  await page.evaluate(() => {
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

  await page.goto('/')
  // Confirm we stay at dashboard (no redirect to profile or login)
  await expect(page).toHaveURL('/')
  await expect(page.locator('main')).toBeVisible()

  await page.context().storageState({ path: authFile })
})
