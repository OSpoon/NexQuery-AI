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
        { key: 'ai_api_key', value: 'sk-mock-key' },
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
    if (
      url.match(/\/api\/ai\/conversations($|\?)/)
      || url.match(/\/api\/ai\/graph\/visualize($|\?)/)
    ) {
      return ok([])
    }
    if (url.match(/\/api\/data-sources($|\?)/)) {
      return ok([{ id: 1, name: 'Test DB', type: 'mysql' }])
    }
    return ok({})
  })
}

test('chat flow: text-to-sql generation and execution', async ({ page }) => {
  await setupAuthAndMocks(page)

  await page.route('**/api/ai/chat/stream', async (route) => {
    const sql = 'SELECT * FROM users'
    // Simplified: One massive data chunk to ensure it is processed
    const body = [
      `data: ${JSON.stringify({ type: 'conversation_id', id: 123 })}\n\n`,
      `data: ${JSON.stringify({ type: 'response', content: 'SQL statement for users:\n```sql\nSELECT * FROM users\n```', sql })}\n\n`,
      `data: [DONE]\n\n`,
    ].join('')

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body,
    })
  })

  await page.route('**/api/ai/preview', async (route) => {
    await route.fulfill({
      json: {
        data: [{ id: 1, name: 'Admin User', email: 'admin@example.com' }],
        columns: ['id', 'name', 'email'],
        duration: 15,
      },
    })
  })

  await page.goto('/')
  await expect(
    page.getByRole('link', { name: 'Dashboard' }).first(),
  ).toBeVisible({ timeout: 15000 })

  await page.locator('#ai-chat-toggle').click()
  await expect(page.getByText('NexQuery AI', { exact: true })).toBeVisible()

  const combobox = page.locator('button[role="combobox"]').first()
  await combobox.click()
  await page.getByRole('option', { name: /Test DB/ }).click()

  const input = page.getByPlaceholder(/Ask a question|type a message/i)
  await input.fill('List all users')
  await input.press('Enter')

  // Wait for ANY part of the response to appear
  await expect(page.getByText(/SQL statement/i)).toBeVisible({
    timeout: 25000,
  })

  const runBtn = page.locator('#run-sql-btn')
  await expect(runBtn).toBeVisible({ timeout: 15000 })
  await runBtn.click()

  await expect(page.getByText('Admin User')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/1 rows/)).toBeVisible()
})
