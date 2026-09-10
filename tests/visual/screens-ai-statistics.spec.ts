import { expect, test } from '@playwright/test'
import { aiStatisticsFixture } from './helpers/ai-statistics-fixture'
import { freezeTime } from './helpers/freeze'
import { mockApi } from './helpers/mock-api'

const route = '/modules/Analitika/analytics/ai-statistics'

test.beforeEach(async ({ page }) => {
  await freezeTime(page)
  await page.addInitScript(`
    localStorage.setItem('webbuh.auth.accessToken', 'visual-fixture-only');
    localStorage.setItem('webbuh.auth.user', JSON.stringify({
      id: 1, login: 'Тестовый пользователь', displayName: 'Тестовый пользователь',
      userEntryId: null, userTypeCode: null, userKind: 'INTERNAL', language: 'Ru',
      mustChangePassword: false, supportAgent: false, passwordChangeDisabled: false
    }));
  `)
  await mockApi(page, {
    'POST /api/view#OPEN': {},
    'GET /api/settings/modules': { data: [], success: true },
    'GET /api/tasks/active': [],
    'GET /api/analytics/ai-statistics': {
      data: aiStatisticsFixture(),
      success: true,
    },
  })
})

test('20 metrics, date grouping and assistant filter', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(route)
  await expect(page.getByTestId('ai-statistic-avgLatencyMs')).toContainText(
    '2,84'
  )
  await expect(page.locator('[data-testid^="ai-statistic-"]')).toHaveCount(20)
  await expect(page.getByTestId('ai-statistic-avgEstimatedCost')).toContainText(
    '0,01476'
  )
  await page.screenshot({
    path: '/tmp/ai-statistics-desktop.png',
    fullPage: true,
  })

  await page
    .getByText('Скорость ответа', { exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/tmp/ai-statistics-charts.png',
    fullPage: true,
  })

  for (const [label, grouping] of [
    ['Недели', 'WEEK'],
    ['Месяцы', 'MONTH'],
  ]) {
    const request = page.waitForRequest(
      (req) =>
        req.url().includes('/api/analytics/ai-statistics') &&
        new URL(req.url()).searchParams.get('groupBy') === grouping
    )
    await page.getByRole('button', { name: label, exact: true }).click()
    await request
  }
  await page.getByRole('button', { name: 'Дни', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Дни', exact: true })
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('combobox', { name: 'ИИ-контур' }).click()
  const filtered = page.waitForRequest(
    (req) =>
      req.url().includes('/api/analytics/ai-statistics') &&
      new URL(req.url()).searchParams.get('surface') === 'ASSISTANT'
  )
  await page.getByRole('option', { name: 'ИИ-помощник', exact: true }).click()
  await filtered
  expect(errors).toEqual([])
})

test('narrow screen keeps dashboard within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(
    "localStorage.setItem('sidebar-settings', JSON.stringify({ isCollapsed: true }))"
  )
  await page.goto(route)
  await page.getByTestId('ai-statistic-requests').scrollIntoViewIfNeeded()
  await expect(page.getByTestId('ai-statistic-requests')).toBeInViewport()
  await expect(page.locator('[data-testid^="ai-statistic-"]')).toHaveCount(20)
  expect(
    await page.evaluate<boolean>(
      'document.documentElement.scrollWidth <= window.innerWidth'
    )
  ).toBe(true)
  await page.screenshot({
    path: '/tmp/ai-statistics-mobile.png',
    fullPage: true,
  })
})

test('failed load can be retried; missing cost is not a zero', async ({
  page,
}) => {
  let failed = true
  await page.route('**/api/analytics/ai-statistics?*', async (request) => {
    if (failed)
      return request.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{}',
      })
    const data = aiStatisticsFixture()
    data.metrics.estimatedCost = null
    data.metrics.avgEstimatedCost = null
    data.metrics.pricedRequests = 0
    data.pricingCoveragePercent = 0
    data.series = data.series.map((row) => ({ ...row, estimatedCost: null }))
    return request.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data, success: true }),
    })
  })
  await page.goto(route)
  await expect(
    page.getByText('Не удалось загрузить статистику ИИ.')
  ).toBeVisible()
  failed = false
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(page.getByTestId('ai-statistic-avgEstimatedCost')).toContainText(
    '—'
  )
  await expect(page.getByTestId('ai-statistic-requests')).toContainText('1')
  await expect(
    page.getByText('Не удалось загрузить статистику ИИ.')
  ).toHaveCount(0)
})

test('empty period stays explicit and oversized dates cannot be applied', async ({
  page,
}) => {
  await page.route('**/api/analytics/ai-statistics?*', (request) => {
    const data = aiStatisticsFixture()
    data.metrics = {
      requests: 0,
      assistantRequests: 0,
      analyticsRequests: 0,
      successCount: 0,
      errorCount: 0,
      successRate: null,
      avgLatencyMs: null,
      p50LatencyMs: null,
      p95LatencyMs: null,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      avgTokens: null,
      estimatedCost: null,
      avgEstimatedCost: null,
      pricedRequests: 0,
      activeUsers: 0,
      conversations: 0,
      models: 0,
      actions: 0,
    }
    data.series = []
    data.byModel = []
    data.pricingCoveragePercent = null
    return request.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data, success: true }),
    })
  })
  await page.goto(route)
  await expect(page.getByText('За этот период обращений нет')).toBeVisible()
  await expect(page.getByTestId('ai-statistic-avgLatencyMs')).toContainText('—')
  await page.getByLabel('С', { exact: true }).fill('2025-01-01')
  await expect(
    page.getByRole('button', { name: 'Применить', exact: true })
  ).toBeDisabled()
})
