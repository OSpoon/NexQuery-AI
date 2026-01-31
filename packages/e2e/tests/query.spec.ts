import { expect, test } from '@playwright/test'

test('create and execute query task', async ({ page }) => {
  // Mock Data Sources
  await page.route('/api/data-sources', async (route) => {
    await route.fulfill({
      json: [{ id: 1, name: 'Test DB', type: 'mysql' }],
    })
  })

  // Mock initial Task List
  await page.route('/api/query-tasks', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ json: [] })
    }
  })

  // Mock Create Task
  await page.route('/api/query-tasks', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { id: 1, name: 'Test Query' } })
    }
  })

  await page.goto('/query-tasks')

  // Open Create Dialog
  await page.getByRole('button', { name: 'Create Task' }).click()

  // Fill Form
  await page.getByLabel('Task Name').fill('Test Query')

  // Select Data Source
  await page.getByRole('combobox', { name: 'Select data source' }).click()
  await page.getByRole('option', { name: 'Test DB (mysql)' }).click()

  // Fill SQL
  // The SQL Editor is hard to interact with directly due to Monaco.
  // We can try to paste into it or bypass if possible.
  // Assuming the editor has a textarea fallback or accessible input:
  // Usually Monaco captures keyboard.
  await page.locator('.monaco-editor').click()
  await page.keyboard.type('SELECT 1 as val')

  // Mock Task List refresh after save
  await page.route('/api/query-tasks', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: [
          {
            id: 1,
            name: 'Test Query',
            dataSource: { name: 'Test DB', type: 'mysql' },
            creator: { fullName: 'E2E User' },
            createdAt: new Date().toISOString(),
          },
        ],
      })
    }
  })

  // Click Save
  await page.getByRole('button', { name: 'Save Task' }).click()
  await expect(page.getByText('Task created')).toBeVisible()

  // Find the new task and click "Run" (Play icon endpoint)
  // This navigates to /query-tasks/1/run

  // Mock the Task Detail fetch on the Run page
  await page.route('/api/query-tasks/1', async (route) => {
    await route.fulfill({
      json: {
        id: 1,
        name: 'Test Query',
        sqlTemplate: 'SELECT 1 as val',
        dataSource: { id: 1, name: 'Test DB' },
        formSchema: [],
      },
    })
  })

  await page.getByRole('button', { name: 'Run' }).first().click()

  await expect(page).toHaveURL(/\/query-tasks\/1\/run/)
  await expect(page.getByText('Test Query')).toBeVisible()

  // Mock Execution
  await page.route('/api/query-tasks/1/execute', async (route) => {
    await route.fulfill({
      json: {
        data: [{ val: 1 }],
        duration: 12,
      },
    })
  })

  await page.getByRole('button', { name: 'Execute' }).click()

  // Verify Results
  await expect(page.getByText('Results')).toBeVisible()
  await expect(page.getByText('1 rows returned')).toBeVisible()
  // Check if grid has value 1
  await expect(page.getByRole('cell', { name: '1' })).toBeVisible()
})

test('ai optimization for sql', async ({ page }) => {
  // Mock Data Sources
  await page.route('/api/data-sources', async (route) => {
    await route.fulfill({
      json: [{ id: 1, name: 'Test DB', type: 'mysql' }],
    })
  })

  // Mock Settings to allow AI
  await page.route('/api/settings', async (route) => {
    await route.fulfill({
      json: [{ key: 'ai_api_key', value: 'sk-mock-key' }],
    })
  })

  // Mock Task List
  await page.route('/api/query-tasks', async (route) => {
    if (route.request().method() === 'GET')
      await route.fulfill({ json: [] })
    if (route.request().method() === 'POST')
      await route.fulfill({ json: { id: 2, name: 'AI Task' } })
  })

  await page.goto('/query-tasks')
  await page.getByRole('button', { name: 'Create Task' }).click()

  // Select Data Source to enable AI button
  await page.getByRole('combobox', { name: 'Select data source' }).click()
  await page.getByRole('option', { name: 'Test DB (mysql)' }).click()

  // Input some SQL to optimize
  await page.locator('.monaco-editor').click()
  await page.keyboard.type('SELECT * FROM users')

  // Mock AI Stream response
  await page.route('/api/ai/optimize-sql', async (route) => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        const chunk = JSON.stringify({ chunk: 'Recommended Index: idx_email' })
        controller.enqueue(encoder.encode(`data: ${chunk}\n\n`))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: stream,
    })
  })

  // Click AI Optimize
  // Note: Button text might be 'AI Optimize' or 'AI Analysis' based on locale/code
  // In code: {{ isOptimizing ? t('query_tasks.analyzing') : t('query_tasks.ai_optimize') }}
  // We'll target the Sparkles icon or broader text match
  await page.getByRole('button', { name: /Optimize|Analyze/i }).click()

  // Verify Result Dialog
  await expect(page.getByText('Recommended Index: idx_email')).toBeVisible()
})
