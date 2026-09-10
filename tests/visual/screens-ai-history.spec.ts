import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './helpers/mock-api'

const route = '/modules/Analitika/ai-history'
const requests: string[] = []
async function fixture(page: Page) {
  await page.addInitScript(`
    localStorage.setItem('webbuh.auth.accessToken', 'visual-fixture-only');
    localStorage.setItem('sidebar-settings', JSON.stringify({ isCollapsed: true }));
    localStorage.setItem('webbuh.auth.user', JSON.stringify({id:1,login:'Тест',displayName:'Тест',userKind:'INTERNAL',language:'Ru',mustChangePassword:false,supportAgent:false}));
  `)
  await mockApi(page, {
    'POST /api/view#OPEN': {},
    'GET /api/settings/modules': { data: [], success: true },
    'GET /api/tasks/active': [],
  })
  const state = { failList: false, failMessages: false }
  requests.length = 0
  await page.route(
    '**/api/ai-assistant/conversations/**',
    async (intercepted) => {
      const url = new URL(intercepted.request().url())
      requests.push(url.pathname + url.search)
      const list = url.pathname.endsWith('/page')
      if (list ? state.failList : state.failMessages)
        return intercepted.fulfill({ status: 503, body: '{}' })
      const before = Number(url.searchParams.get('beforeId') ?? 26)
      const newest = before - 1
      const ids = Array.from(
        { length: Math.min(10, newest) },
        (_, i) => newest - i
      )
      const hasMore = newest > 10
      const nextBeforeId = hasMore ? ids.at(-1) : null
      const conversation = Number(
        /conversations\/(\d+)/.exec(url.pathname)?.[1] ?? 0
      )
      const data = list
        ? {
            conversations: ids.map((id) => ({
              id,
              title: `Диалог ${String(id)}`,
              createdAt: '2026-09-10T10:30:00+05:00',
            })),
            hasMore,
            nextBeforeId,
          }
        : {
            messages: ids.reverse().map((id) => ({
              id: conversation * 100 + id,
              role: id % 2 ? 'USER' : 'ASSISTANT',
              content:
                `Чат ${String(conversation)} сообщение ${String(id)}. ` +
                'Подробное объяснение сохранённых результатов. '.repeat(8),
              createdAt: `2026-09-10T10:${String(id).padStart(2, '0')}:00+05:00`,
            })),
            hasMore,
            nextBeforeId:
              nextBeforeId == null ? null : conversation * 100 + nextBeforeId,
          }
      // Message cursors are real message IDs, independent of conversation IDs.
      if (!list && before > 100) {
        const newestMessage = (before % 100) - 1
        const older = Array.from(
          { length: Math.min(10, newestMessage) },
          (_, i) => newestMessage - i
        ).reverse()
        Object.assign(data, {
          messages: older.map((id) => ({
            id: conversation * 100 + id,
            role: id % 2 ? 'USER' : 'ASSISTANT',
            content:
              `Чат ${String(conversation)} сообщение ${String(id)}. ` +
              'Подробное объяснение сохранённых результатов. '.repeat(8),
            createdAt: `2026-09-10T10:${String(id).padStart(2, '0')}:00+05:00`,
          })),
          hasMore: newestMessage > 10,
          nextBeforeId:
            newestMessage > 10 ? conversation * 100 + older[0] : null,
        })
      }
      await intercepted.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data, success: true }),
      })
    }
  )
  return state
}
const messageRows = (page: Page) =>
  page.getByTestId('history-messages').locator('[data-assistant-message-id]')

for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'}: 25 chats and messages load by cursor; switching and reload preserve history`, async ({
    page,
  }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await fixture(page)
    await page.goto(route)
    const list = page.getByTestId('history-conversations')
    await expect(list.getByRole('button')).toHaveCount(11)
    for (const count of [20, 25]) {
      await page.evaluate(
        "{ const el = document.querySelector('[data-testid=history-conversations]'); el.scrollTop = el.scrollHeight }"
      )
      await expect(list.getByText(/^Диалог \d+$/)).toHaveCount(count)
    }
    await list.getByText('Диалог 25', { exact: true }).click()
    await expect(messageRows(page)).toHaveCount(10)
    await expect(
      page.getByTestId('history-messages').locator('time').last()
    ).toHaveText('10:25')
    const scroller = page.getByTestId('history-messages')
    for (const count of [20, 25]) {
      const anchor = await page.evaluate<{ id: string; offset: number }>(
        "(() => { const el = document.querySelector('[data-testid=history-messages]'); el.scrollTop = 50; const top = el.getBoundingClientRect().top; const row = [...el.querySelectorAll('[data-assistant-message-id]')].find(row => row.getBoundingClientRect().bottom > top); return {id: row.dataset.assistantMessageId, offset: row.getBoundingClientRect().top - top}; })()"
      )
      await expect(messageRows(page)).toHaveCount(count)
      const offset = await page.evaluate<number>(
        `document.querySelector('[data-assistant-message-id="${anchor.id}"]').getBoundingClientRect().top - document.querySelector('[data-testid=history-messages]').getBoundingClientRect().top`
      )
      expect(Math.abs(offset - anchor.offset)).toBeLessThanOrEqual(1)
    }
    expect(
      await page.evaluate<number>(
        "new Set([...document.querySelectorAll('[data-assistant-message-id]')].map(row => row.getAttribute('data-assistant-message-id'))).size"
      )
    ).toBe(25)
    if (mobile) {
      const timeBounds = await page.evaluate<boolean>(
        "(() => { const container = document.querySelector('[data-testid=history-messages]').getBoundingClientRect(); return [...document.querySelectorAll('[data-testid=history-messages] time')].every(time => { const bounds = time.getBoundingClientRect(); if (bounds.left < Math.max(0, container.left) || bounds.right > Math.min(window.innerWidth, container.right)) return false; for (let parent = time.parentElement; parent; parent = parent.parentElement) { if (['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(parent).overflowX)) { const clip = parent.getBoundingClientRect(); if (bounds.left < clip.left || bounds.right > clip.right) return false; } } return true; }); })()"
      )
      expect(timeBounds).toBe(true)
    }
    await page.screenshot({
      path: `/tmp/ai-history-${mobile ? 'mobile' : 'desktop'}.png`,
      fullPage: true,
    })
    if (mobile)
      await page.getByRole('button', { name: 'К списку диалогов' }).click()
    await list.getByText('Диалог 24', { exact: true }).click()
    await expect(messageRows(page)).toHaveCount(10)
    await expect(scroller).toContainText('Чат 24 сообщение 25')
    await expect(scroller).not.toContainText('Чат 25 сообщение')
    await page.reload()
    await expect(scroller).toContainText('Чат 24 сообщение 25')
    expect(
      await page.evaluate<boolean>(
        'document.documentElement.scrollWidth <= window.innerWidth'
      )
    ).toBe(true)
    expect(
      requests
        .filter((url) => url.includes('/page'))
        .every((url) => url.includes('limit=10'))
    ).toBe(true)
    expect(requests.some((url) => url.includes('beforeId=2516'))).toBe(true)
    expect(requests.some((url) => url.includes('beforeId=2506'))).toBe(true)
  })
}

test('history list and message failures offer retry without losing the selected chat', async ({
  page,
}) => {
  const state = await fixture(page)
  state.failList = true
  await page.goto(route)
  await expect(page.getByText('Не удалось загрузить историю')).toBeVisible()
  state.failList = false
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await page.getByText('Диалог 25', { exact: true }).click()
  await expect(messageRows(page)).toHaveCount(10)
  state.failMessages = true
  await page.evaluate(
    "document.querySelector('[data-testid=history-messages]').scrollTop = 0"
  )
  await expect(
    page
      .getByTestId('history-messages')
      .getByText('Не удалось загрузить историю')
  ).toBeVisible()
  await expect(messageRows(page)).toHaveCount(10)
  state.failMessages = false
  await page.getByRole('button', { name: 'Повторить', exact: true }).click()
  await expect(messageRows(page)).toHaveCount(20)
  await expect(page).toHaveURL(/conversationId=25/)
})

test('widget History button opens the full history without invoking the model', async ({
  page,
}) => {
  await fixture(page)
  await page.route('**/api/ai-assistant/settings', (intercepted) =>
    intercepted.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: { enabled: true, capabilities: [] },
        success: true,
      }),
    })
  )
  await page.route('**/api/ai-assistant/conversations', (intercepted) =>
    intercepted.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [], success: true }),
    })
  )
  const modelCalls: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/ai-assistant/ask'))
      modelCalls.push(request.url())
  })
  await page.goto(route)
  await page
    .getByRole('button', { name: 'Открыть ИИ-помощника', exact: true })
    .click()
  await page.getByRole('button', { name: 'История', exact: true }).click()
  await expect(page).toHaveURL(/\/modules\/[^/]+\/ai-history$/)
  await expect(page.getByTestId('history-conversations')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'История', exact: true })
  ).toHaveCount(0)
  expect(modelCalls).toEqual([])
})
