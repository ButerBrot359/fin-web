import { expect, test } from '@playwright/test'
import { freezeTime } from './helpers/freeze'
import { mockApi } from './helpers/mock-api'

test('connection pricing preserves explicit zero, clears unknown rates and saves cache opt-in', async ({
  page,
}) => {
  await freezeTime(page)
  await page.addInitScript(
    `localStorage.setItem('webbuh.auth.accessToken','visual-fixture-only');localStorage.setItem('webbuh.auth.user',JSON.stringify({id:1,login:'Тест',displayName:'Тест',userKind:'INTERNAL',language:'Ru',mustChangePassword:false}));`
  )
  const connection = {
    id: 1,
    name: 'Claude pricing fixture',
    provider: 'ANTHROPIC',
    model: 'claude-sonnet-4-6',
    baseUrl: null,
    hasApiKey: true,
    apiKeyMask: '***test',
    temperature: 0.2,
    maxTokens: 8000,
    external: true,
    usedBy: [],
    cacheEnabled: false,
    pricingCurrency: 'USD',
    pricing: {
      inputPerMillion: 3,
      outputPerMillion: 15,
      cacheReadPerMillion: 0.3,
      cacheWritePerMillion: null,
      cacheWrite5mPerMillion: 3.75,
      cacheWrite1hPerMillion: 6,
    },
  }
  await mockApi(page, {
    'POST /api/view#OPEN': {},
    'GET /api/settings/modules': { data: [], success: true },
    'GET /api/tasks/active': [],
    'GET /api/ai-connections': { data: [connection], success: true },
    'PUT /api/ai-connections/1': { data: connection, success: true },
    'GET /api/analytics/ai-settings': { data: null, success: true },
    'GET /api/analytics/ai-settings/models': { data: [], success: true },
  })
  let savedConnection: Record<string, unknown> = {
    ...connection,
    provider: 'ANTHROPIC',
    pricingCurrency: 'USD',
    usedBy: [],
  }
  await page.route('**/api/ai-connections', (route) =>
    route.fulfill({ json: { data: [savedConnection], success: true } })
  )
  await page.route('**/api/ai-connections/1', async (route) => {
    const request = route.request().postDataJSON() as Record<string, unknown>
    savedConnection = {
      ...savedConnection,
      ...request,
      pricing: request.pricing ?? savedConnection.pricing,
      cacheEnabled: request.cacheEnabled ?? savedConnection.cacheEnabled,
      baseUrl: null,
    }
    await route.fulfill({ json: { data: savedConnection, success: true } })
  })
  await page.goto('/modules/Analitika/analytics/settings')
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Обычный вход', { exact: true })).toHaveValue(
    '3'
  )
  await dialog.getByLabel('Обычный вход', { exact: true }).fill('0')
  await dialog.getByLabel('Выход', { exact: true }).fill('')
  await dialog.getByLabel('Чтение кеша', { exact: true }).fill('-1')
  await expect(
    dialog.getByRole('button', { name: 'Сохранить', exact: true })
  ).toBeDisabled()
  await dialog.getByLabel('Чтение кеша', { exact: true }).fill('0,25')
  await dialog
    .getByRole('checkbox', { name: 'Запрашивать кэширование промпта' })
    .check()
  await dialog
    .getByText('Тарифы модели', { exact: true })
    .scrollIntoViewIfNeeded()
  await page.screenshot({
    path: '/tmp/ai-pricing-desktop.png',
    animations: 'disabled',
    fullPage: true,
  })
  const saved = page.waitForRequest(
    (request) =>
      request.method() === 'PUT' &&
      request.url().endsWith('/api/ai-connections/1')
  )
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  expect((await saved).postDataJSON()).toMatchObject({
    cacheEnabled: true,
    pricing: {
      inputPerMillion: 0,
      outputPerMillion: null,
      cacheReadPerMillion: 0.25,
      cacheWritePerMillion: null,
      cacheWrite5mPerMillion: 3.75,
      cacheWrite1hPerMillion: 6,
    },
  })
  await expect(dialog).not.toBeVisible()
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click()
  await expect(dialog.getByLabel('Обычный вход', { exact: true })).toHaveValue(
    '0'
  )
  await expect(dialog.getByLabel('Выход', { exact: true })).toHaveValue('')
  await expect(dialog.getByLabel('Чтение кеша', { exact: true })).toHaveValue(
    '0.25'
  )
  await expect(
    dialog.getByRole('checkbox', { name: 'Запрашивать кэширование промпта' })
  ).toBeChecked()
})
