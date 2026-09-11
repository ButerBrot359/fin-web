import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './helpers/mock-api'
import { readFileSync } from 'node:fs'
const wireFixture = (kind: string) =>
  JSON.parse(
    readFileSync(
      new URL(`./fixtures/analytics-workspace/${kind}.json`, import.meta.url),
      'utf8'
    )
  ) as { answer: { data: { spec: { title: string } } }; query: unknown }
const dashboardWire = wireFixture('dashboard')
const reportWire = wireFixture('report')

type Kind = 'DASHBOARD' | 'REPORT'
interface Chat {
  id: number
  kind: Kind
  messages: Record<string, unknown>[]
}
const columns = [
  { name: 'month', label: 'Месяц', type: 'STRING' },
  {
    name: 'amount',
    label: 'Расходы',
    type: 'DECIMAL',
    format: 'MONEY',
    total: 'SUM',
  },
]
function artifact(kind: Kind) {
  const dataset = {
    id: 'expenses',
    sql: 'SELECT month, amount FROM analytics.v_fixture LIMIT 100',
    sqlHash: 'fixture-hash',
    parameters: [],
    columns,
  }
  return {
    specVersion: 1,
    kind,
    title: kind === 'DASHBOARD' ? 'Расходы по месяцам' : 'Отчёт о расходах',
    description: 'Показатели за выбранный период',
    parameters: [],
    datasets: [dataset],
    layout: { columns: 12, rowHeight: 80 },
    sourceViews: ['analytics.v_fixture'],
    widgets:
      kind === 'DASHBOARD'
        ? [
            {
              id: 'expenses-chart',
              type: 'BAR_HORIZONTAL',
              title: 'Динамика расходов',
              datasetId: 'expenses',
              position: { x: 0, y: 0, w: 12, h: 4 },
              encoding: { x: { field: 'month' }, y: [{ field: 'amount' }] },
              options: {},
            },
            {
              id: 'expenses-table',
              type: 'TABLE',
              title: 'Расходы подробно',
              datasetId: 'expenses',
              position: { x: 0, y: 4, w: 12, h: 4 },
              encoding: { columns: [{ field: 'month' }, { field: 'amount' }] },
              options: {},
            },
          ]
        : [
            {
              id: 'expenses-report',
              type: 'TABLE',
              title: 'Расходы',
              datasetId: 'expenses',
              position: { x: 0, y: 0, w: 12, h: 6 },
              encoding: { columns: [{ field: 'month' }, { field: 'amount' }] },
              options: {},
            },
          ],
  }
}
async function server(page: Page) {
  await page.addInitScript(`
    localStorage.setItem('webbuh.auth.accessToken','visual-fixture-only');
    localStorage.setItem('sidebar-settings',JSON.stringify({isCollapsed:true}));
    localStorage.setItem('webbuh.auth.user',JSON.stringify({id:7,login:'test-accountant',displayName:'Тестовый пользователь',userKind:'INTERNAL',language:'Ru',supportAgent:false}));
  `)
  await mockApi(page, {
    'POST /api/view#OPEN': {},
    'GET /api/settings/modules': { data: [], success: true },
    'GET /api/tasks/active': [],
    'GET /api/support/calls/active': { __status: 204, __body: null },
    'GET /api/analytics/organizations': { data: [], success: true },
  })
  const chats = new Map<number, Chat>()
  const saved = new Map<string, Record<string, unknown>>()
  let nextId = 10
  const sent: { kind: Kind; prompt: string; conversationId?: number }[] = []
  await page.route('**/api/analytics/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const respond = (data: unknown) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data, success: true }),
      })
    if (path.endsWith('/assistant/generate')) {
      const body = route.request().postDataJSON() as {
        kind: Kind
        prompt: string
        conversationId?: number
      }
      sent.push(body)
      const chat = body.conversationId
        ? chats.get(body.conversationId)!
        : { id: ++nextId, kind: body.kind, messages: [] }
      expect(chat.kind).toBe(body.kind)
      chats.set(chat.id, chat)
      const first = chat.messages.length === 0
      const failed = body.prompt === 'Исправь недоступный источник'
      const status = first ? 'CLARIFICATION' : failed ? 'FAILED' : 'READY'
      const questions = first
        ? [
            {
              id: 'period',
              text: 'За какой период показать расходы?',
              options: ['За этот год', 'За прошлый год'],
            },
          ]
        : []
      const explanation = first
        ? 'Помогу разобраться в расходах. Уточним период.'
        : failed
          ? 'Этот источник сейчас недоступен. Можно выбрать другой вариант.'
          : 'Готово. Расходы сгруппированы по месяцам. Можно изменить детализацию или сохранить результат.'
      const spec = status === 'READY' ? artifact(body.kind) : null
      const suggestions = failed ? ['Показать обороты по счетам'] : []
      const userMessageId = chat.messages.length + 1
      const messageId = userMessageId + 1
      const userCreatedAt = '2026-09-11T14:00:00+05:00'
      const createdAt = '2026-09-11T14:00:10+05:00'
      chat.messages.push(
        {
          id: userMessageId,
          role: 'USER',
          content: body.prompt,
          createdAt: userCreatedAt,
        },
        {
          id: messageId,
          role: 'ASSISTANT',
          content: explanation,
          spec,
          status,
          questions,
          suggestions,
          createdAt,
          llmRequestId: 100,
          errorMessage: failed ? explanation : null,
        }
      )
      return respond({
        conversationId: chat.id,
        messageId,
        userMessageId,
        userCreatedAt,
        createdAt,
        status,
        questions,
        suggestions,
        spec,
        explanation,
        warnings: [],
        violations: failed ? ['Источник недоступен'] : [],
        llmRequestIds: [100],
        repaired: false,
      })
    }
    if (path.includes('/assistant/conversations/')) {
      const chat = chats.get(Number(path.split('/').at(-1)))
      return respond({
        ...chat,
        title: 'Расходы',
        createdAt: '2026-09-11T14:00:00+05:00',
      })
    }
    if (path.endsWith('/query/execute'))
      return respond({
        columns: columns.map(({ name, type }) => ({ name, type })),
        rows: [
          ['Январь', 120000],
          ['Февраль', 180000],
        ],
        rowCount: 2,
        truncated: false,
        executionMs: 4,
        sqlHash: 'fixture-hash',
      })
    if (path.endsWith('/items') && route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      const code =
        body.kind === 'DASHBOARD' ? 'saved-dashboard' : 'saved-report'
      const item = { ...body, code, version: 1 }
      saved.set(code, item)
      return respond(item)
    }
    if (path.includes('/items/'))
      return respond(saved.get(path.split('/').at(-1)!))
    return route.fallback()
  })
  return { chats, saved, sent }
}
async function send(page: Page, text: string) {
  const input = page.getByTestId('analytics-composer-input')
  await expect(input).toBeEnabled()
  await input.fill(text)
  await input.press('Enter')
}
for (const kind of ['DASHBOARD', 'REPORT'] as const) {
  test(`${kind} clarification, result, recovery and save stay in their own workspace`, async ({
    page,
  }, info) => {
    const state = await server(page)
    await page.goto('/modules/Main/analytics/assistant')
    await page
      .getByTestId(
        kind === 'DASHBOARD'
          ? 'analytics-mode-dashboard'
          : 'analytics-mode-report'
      )
      .click()
    await expect(page).toHaveURL(
      new RegExp(
        kind === 'DASHBOARD' ? 'assistant-dashboards' : 'assistant-reports'
      )
    )
    await send(page, 'Хочу разобраться в расходах')
    await expect(
      page.getByText('За какой период показать расходы?', { exact: true })
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByText('За какой период показать расходы?', { exact: true })
    ).toBeVisible()
    await page.getByRole('button', { name: 'За этот год', exact: true }).click()
    await expect(page.getByTestId('analytics-result-panel')).toContainText(
      kind === 'DASHBOARD' ? 'Расходы по месяцам' : 'Отчёт о расходах'
    )
    const build = page.getByRole('button', {
      name: 'Сформировать',
      exact: true,
    })
    if (kind === 'REPORT' && (await build.isVisible())) await build.click()
    await expect(page.getByTestId('analytics-result-panel')).toContainText(
      'Январь'
    )
    await expect(page.getByTestId('analytics-result-panel')).toContainText(
      'Февраль'
    )
    if (kind === 'DASHBOARD') {
      await expect
        .poll(async () => {
          const box = await page
            .locator('.MuiBarChart-element')
            .last()
            .boundingBox()
          return box?.width ?? 0
        })
        .toBeGreaterThan(150)
    }
    const times = page.getByTestId('analytics-chat-scroll').locator('time')
    await expect(times).toHaveCount(4)
    expect(await times.allTextContents()).toEqual([
      '14:00',
      '14:00',
      '14:00',
      '14:00',
    ])
    expect(state.sent.map((entry) => entry.kind)).toEqual([kind, kind])
    expect(state.sent[1].conversationId).toBeGreaterThan(0)
    const chatBox = await page
      .getByTestId('analytics-chat-scroll')
      .boundingBox()
    expect(chatBox!.height).toBeGreaterThan(350)
    await page.screenshot({
      path: info.outputPath(`${kind.toLowerCase()}-workspace.png`),
      fullPage: true,
    })
    await send(page, 'Исправь недоступный источник')
    await expect(
      page.getByRole('button', {
        name: /Показать обороты по счетам/,
      })
    ).toBeVisible()
    await expect(page.getByTestId('analytics-result-panel')).toContainText(
      'Январь'
    )
    await page
      .getByRole('button', { name: /Сохранить/, exact: false })
      .first()
      .click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
    await expect(page).toHaveURL(
      new RegExp(kind === 'DASHBOARD' ? 'saved-dashboard' : 'saved-report')
    )
    expect(state.saved.size).toBe(1)
    expect([...state.saved.values()][0].kind).toBe(kind)
  })
}

test('dashboard and report chats remain separate and mobile composer fits', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await server(page)
  await page.goto('/modules/Main/analytics/assistant-dashboards')
  await send(page, 'Мой дашборд расходов')
  await expect(
    page.getByText('За какой период показать расходы?', { exact: true })
  ).toBeVisible()
  await page.goto('/modules/Main/analytics/assistant-reports')
  await expect(page.getByTestId('analytics-chat-scroll')).not.toContainText(
    'Мой дашборд расходов'
  )
  await send(page, 'Мой табличный отчёт')
  await expect(
    page.getByText('За какой период показать расходы?', { exact: true })
  ).toBeVisible()
  await page.goto('/modules/Main/analytics/assistant-dashboards')
  await expect(page.getByTestId('analytics-chat-scroll')).toContainText(
    'Мой дашборд расходов'
  )
  await expect(page.getByTestId('analytics-chat-scroll')).not.toContainText(
    'Мой табличный отчёт'
  )
  const dimensions = await page.evaluate<{ width: number; scroll: number }>(
    `({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})`
  )
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1)
  const input = await page.getByTestId('analytics-composer-input').boundingBox()
  expect(input!.y + input!.height).toBeLessThanOrEqual(844)
  await page.screenshot({
    path: info.outputPath('analytics-mobile-chat.png'),
    fullPage: true,
  })
})

// Captured from AnalyticsWorkspaceCucumber: actual HTTP responses, PostgreSQL
// accounting view and persisted items; the LOCAL model uses synthetic responses.
for (const [kind, wire] of [
  ['DASHBOARD', dashboardWire],
  ['REPORT', reportWire],
] as const) {
  test(`${kind} renders the actual backend acceptance contract`, async ({
    page,
  }) => {
    await server(page)
    await page.route('**/api/analytics/assistant/generate', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(wire.answer),
      })
    )
    await page.route('**/api/analytics/query/execute', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(wire.query),
      })
    )
    await page.goto(
      `/analytics/${kind === 'DASHBOARD' ? 'assistant-dashboards' : 'assistant-reports'}`
    )
    await send(page, 'Покажи расходы по месяцам')
    const result = page.getByTestId('analytics-result-panel')
    await expect(result).toContainText(wire.answer.data.spec.title)
    await expect(result).toContainText('2026-01')
    await expect(result).toContainText('2026-02')
    if (kind === 'DASHBOARD') {
      await expect(result.locator('.MuiBarChart-element')).toHaveCount(2)
      await expect
        .poll(async () => {
          const box = await result
            .locator('.MuiBarChart-element')
            .last()
            .boundingBox()
          return box?.width ?? 0
        })
        .toBeGreaterThan(150)
    } else {
      await expect(
        result.getByRole('cell', { name: '100', exact: true })
      ).toBeVisible()
      await expect(
        result.getByRole('cell', { name: '200', exact: true })
      ).toBeVisible()
    }
  })
}
