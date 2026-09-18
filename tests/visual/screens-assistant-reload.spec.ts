import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './helpers/mock-api'

const longLabel = 'Ручная корректировка счёта учёта'
const longValue =
  'Любой счёт учёта в строке табличной части можно изменить вручную, если это разрешено настройками документа. Проверьте реквизиты перед проведением.'
interface Stored {
  id: number
  role: string
  content: string
  createdAt: string
  answer?: Record<string, unknown>
  error?: string
}
async function server(page: Page) {
  await page.addInitScript(`
    localStorage.setItem('webbuh.auth.accessToken', 'visual-fixture-only');
    localStorage.setItem('sidebar-settings', JSON.stringify({isCollapsed:true}));
    localStorage.setItem('webbuh.auth.user', JSON.stringify({id:7,login:'test-accountant',displayName:'Тестовый бухгалтер',userKind:'INTERNAL',language:'Ru',supportAgent:false}));
  `)
  await mockApi(page, {
    'POST /api/view#OPEN': {},
    'GET /api/settings/modules': { data: [], success: true },
    'GET /api/tasks/active': [],
    'GET /api/support/calls/active': { __status: 204, __body: null },
    'GET /api/ai-assistant/settings': {
      data: { enabled: true, capabilities: [] },
      success: true,
    },
  })
  const state = {
    messages: [] as Stored[],
    requests: new Map<string, Record<string, unknown>>(),
    asks: 0,
    pending: false,
    finish: (): void => {
      throw new Error('No pending request')
    },
  }
  await page.route('**/api/ai-assistant/**', async (route) => {
    const url = new URL(route.request().url())
    const respond = (data: unknown) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data, success: true }),
      })
    const conversations = state.messages.length
      ? [
          {
            id: 101,
            title: 'Проверка переписки',
            createdAt: '2026-09-11T13:00:00+05:00',
            contextType: null,
            contextId: null,
          },
        ]
      : []
    if (url.pathname.endsWith('/conversations')) return respond(conversations)
    if (url.pathname.endsWith('/conversations/page'))
      return respond({ conversations, hasMore: false, nextBeforeId: null })
    if (url.pathname.endsWith('/messages')) {
      expect(url.searchParams.get('limit')).toBe('10')
      const before = Number(
        url.searchParams.get('beforeId') ?? Number.MAX_SAFE_INTEGER
      )
      const eligible = state.messages.filter((message) => message.id < before)
      const messages = eligible.slice(-10)
      return respond({
        messages,
        hasMore: eligible.length > 10,
        nextBeforeId: eligible.length > 10 ? messages[0].id : null,
      })
    }
    if (url.pathname.includes('/requests/')) {
      const id = decodeURIComponent(url.pathname.split('/').at(-1)!)
      const saved = state.requests.get(id)
      if (!saved) return route.fulfill({ status: 404, body: '{}' })
      return respond(saved)
    }
    if (url.pathname.endsWith('/ask')) {
      const body = route.request().postDataJSON() as {
        question: string
        requestId: string
        conversationId?: number
      }
      state.asks++
      if (state.asks > 1) expect(body.conversationId).toBe(101)
      const userMessageId = state.messages.length + 1
      const assistantMessageId = userMessageId + 1
      const userCreatedAt = `2026-09-11T13:${String(state.asks).padStart(2, '0')}:00+05:00`
      const createdAt = `2026-09-11T13:${String(state.asks).padStart(2, '0')}:12+05:00`
      state.messages.push({
        id: userMessageId,
        role: 'USER',
        content: body.question,
        createdAt: userCreatedAt,
      })
      const answer = {
        conversationId: 101,
        userMessageId,
        assistantMessageId,
        requestId: body.requestId,
        conclusion: `Ответ ${String(state.asks)}. Сохранён полностью.`,
        breakdown: [
          { label: longLabel, value: longValue },
          { label: 'Итого', value: '123 456,78 ₸' },
        ],
        sources: ['Реквизиты документа'],
        missing: 'Уточните период',
        actions: [{ kind: 'SHOW_ROWS', label: 'Показать строки документа' }],
        created: [],
        latencyMs: 1200,
        userCreatedAt,
        createdAt,
      }
      state.requests.set(body.requestId, {
        requestId: body.requestId,
        conversationId: 101,
        userMessageId,
        status: 'RUNNING',
        userCreatedAt,
      })
      const finish = () => {
        state.messages.push({
          id: assistantMessageId,
          role: 'ASSISTANT',
          content: answer.conclusion,
          createdAt,
          answer,
        })
        state.requests.set(body.requestId, {
          requestId: body.requestId,
          conversationId: 101,
          userMessageId,
          assistantMessageId,
          status: 'COMPLETED',
          answer,
          userCreatedAt,
          createdAt,
        })
      }
      if (state.pending)
        await new Promise<void>((resolve) => {
          state.finish = () => {
            finish()
            resolve()
          }
        })
      else finish()
      return respond(answer).catch(() => undefined)
    }
    return route.fallback()
  })
  return state
}
async function open(page: Page) {
  await page
    .getByRole('button', { name: 'Открыть ИИ-помощника', exact: true })
    .click()
  await expect(page.getByTestId('ai-assistant-panel')).toBeVisible()
}
const rows = (page: Page) =>
  page.getByTestId('assistant-messages').locator('[data-assistant-message-id]')

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} long breakdown fits and every message survives reload with 10-message pages`, async ({
    page,
  }, testInfo) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await server(page)
    await page.goto('/modules/Main/ai-history')
    await open(page)
    const panel = page.getByTestId('ai-assistant-panel')
    for (let i = 1; i <= 6; i++) {
      const input = panel.getByRole('textbox')
      await expect(input).toBeEnabled()
      await input.fill(`Вопрос ${String(i)}: как проверить документ?`)
      await input.press('Enter')
      await expect(rows(page)).toHaveCount(i * 2)
      await expect(rows(page).last()).toContainText(`Ответ ${String(i)}`)
    }
    const before = await rows(page).allTextContents()
    const label = panel.getByText(longLabel, { exact: true }).last()
    await label.scrollIntoViewIfNeeded()
    const labelBox = await label.boundingBox()
    expect(labelBox!.width).toBeGreaterThan(85)
    expect(labelBox!.height).toBeLessThan(150)
    const dimensions = await page.evaluate<{ client: number; scroll: number }>(
      `(() => { const element=document.querySelector('[data-testid=assistant-messages]'); return {client:element.clientWidth,scroll:element.scrollWidth}; })()`
    )
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1)
    await page.screenshot({
      path: testInfo.outputPath('assistant-readable.png'),
    })
    await page.reload()
    await open(page)
    await expect(rows(page)).toHaveCount(10)
    expect(await rows(page).allTextContents()).toEqual(before.slice(-10))
    await page.evaluate(
      `document.querySelector('[data-testid=assistant-messages]').scrollTop = 0`
    )
    await expect(rows(page)).toHaveCount(12)
    expect(await rows(page).allTextContents()).toEqual(before)
  })
}

test('reload during a running request recovers the final answer without repeating the action', async ({
  page,
}) => {
  const state = await server(page)
  state.pending = true
  await page.goto('/modules/Main/ai-history')
  await open(page)
  const input = page.getByTestId('ai-assistant-panel').getByRole('textbox')
  await expect(input).toBeEnabled()
  await input.fill('Долгий запрос')
  await input.press('Enter')
  await expect.poll(() => state.asks).toBe(1)
  await page.reload()
  await open(page)
  await expect(rows(page).first()).toContainText('Долгий запрос')
  state.finish()
  await expect(rows(page)).toHaveCount(2)
  await expect(rows(page).last()).toContainText('Ответ 1. Сохранён полностью.')
  await expect(rows(page).last()).toContainText(longValue)
  expect(state.asks).toBe(1)
  const before = await rows(page).allTextContents()
  await page.reload()
  await open(page)
  await expect(rows(page)).toHaveCount(2)
  expect(await rows(page).allTextContents()).toEqual(before)
  expect(state.asks).toBe(1)
})
