import { expect, test } from '@playwright/test'
import { mockApi } from './helpers/mock-api'
import { loadFixture } from './helpers/load-fixture'

// Matches document-history-handoff.md and ShowHistoryWireContractTest.
const bindings = [
  'occurredAt',
  'originLabel',
  'action',
  'outcome',
  'userName',
  'changes',
  'message',
]
const labels = [
  'Когда',
  'Источник',
  'Действие',
  'Итог',
  'Кто',
  'Что изменилось',
  'Примечание',
]
const widths = [160, 170, 220, 150, 220, 300, 250]
const history = {
  id: 'dlg.history.27857683',
  type: 'PAGE',
  props: { presentation: 'drawer', title: 'История изменений', width: 1560 },
  children: [
    {
      id: 'table.history',
      type: 'TABLE',
      binding: 'history',
      props: {
        editable: false,
        readOnly: true,
        columnsResizable: true,
        columnStateKey: 'audit-history',
        pagination: {
          mode: 'PAGED',
          loadTrigger: 'INFINITE_SCROLL',
          pageSize: 50,
          source: {
            url: '/api/document-entries/27857683/history/rows',
            params: { language: 'RU' },
          },
        },
      },
      children: bindings.map((binding, index) => ({
        id: `col.${binding}`,
        type: 'TABLE_COLUMN',
        binding,
        props: { label: labels[index], width: widths[index], editable: false },
      })),
    },
  ],
}
for (const mobile of [false, true]) {
  test(`${mobile ? 'mobile' : 'desktop'} showHistory: provenance, details and infinite history pages`, async ({
    page,
  }, testInfo) => {
    // Open the document in the desktop shell, then verify its drawer at mobile width.
    await page.addInitScript(() => {
      localStorage.setItem('webbuh.auth.accessToken', 'visual-fixture-only')
      localStorage.setItem(
        'webbuh.auth.user',
        JSON.stringify({
          id: 7,
          login: 'accountant',
          displayName: 'Татьяна Мельникова',
          userKind: 'INTERNAL',
          language: 'Ru',
          mustChangePassword: false,
        })
      )
    })
    const fixture = loadFixture('otpusk-card.json')
    const key =
      'POST /api/view#OPEN@/modules/ZarplatiIKadri/document/Otpusk/27857683'
    const opened = fixture[key] as { tree: { children: unknown[] } }
    opened.tree.children = [
      {
        id: 'toolbar',
        type: 'TOOLBAR',
        children: [
          {
            id: 'btn.history',
            type: 'BUTTON',
            props: {
              label: 'История',
              command: 'showHistory',
              enabled: true,
              pinned: true,
            },
            actions: [
              { trigger: 'click', actionId: 'command', command: 'showHistory' },
            ],
          },
        ],
      },
    ]
    fixture['POST /api/view#COMMAND'] = {
      formSessionId: '939c68f5-c147-44b4-96b9-5db946a09827',
      revision: 1,
      effects: [{ type: 'openDialog', node: history }],
    }
    await mockApi(page, fixture)
    const requested: number[] = []
    await page.route(
      '**/api/document-entries/27857683/history/rows?**',
      async (route) => {
        const url = new URL(route.request().url())
        const number = Number(url.searchParams.get('page'))
        requested.push(number)
        expect(url.searchParams.get('size')).toBe('50')
        expect(url.searchParams.get('language')).toBe('RU')
        const content = Array.from(
          { length: number === 0 ? 50 : 1 },
          (_, i) => {
            const id = number * 50 + i + 1
            return {
              id,
              rowId: id,
              occurredAt: '11.09.2026 10:16:47',
              action: 'Изменение',
              actionCode: 'UPDATE',
              outcome: 'Выполнено',
              outcomeCode: 'SUCCESS',
              userName: 'Татьяна Мельникова',
              origin: id === 1 ? 'AI' : id === 2 ? 'UNKNOWN' : 'USER',
              originLabel:
                id === 1 ? 'ИИ' : id === 2 ? 'Не зафиксирован' : 'Пользователь',
              changes: 'Ответственный: — → Татьяна Мельникова',
              message: `Запись ${String(id)}`,
              changesDetails: [
                {
                  field: 'Otvetstvennyy',
                  label: 'Ответственный',
                  before: null,
                  after: 'Татьяна Мельникова',
                },
              ],
              ...(id === 1
                ? {
                    ai: {
                      tool: 'UPDATE_DOCUMENT',
                      toolLabel: 'Изменение реквизитов',
                      attribution: 'EVENT',
                      initiatedBy: {
                        userId: 7,
                        name: 'Татьяна Мельникова',
                        login: 'accountant',
                      },
                      executionId: '9f890e10-e92c-441c-b548-178d65cc9f56',
                      stepId: 'update',
                    },
                  }
                : {}),
            }
          }
        )
        await route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: { content, number, last: number === 1, totalElements: 51 },
          }),
        })
      }
    )
    await page.goto('/modules/ZarplatiIKadri/document/Otpusk/27857683')
    const command = page.waitForRequest(
      (r) =>
        r.url().includes('/api/view') &&
        (r.postDataJSON() as { action?: { command?: string } } | null)?.action
          ?.command === 'showHistory'
    )
    await page.getByRole('button', { name: 'История', exact: true }).click()
    await command
    if (mobile) await page.setViewportSize({ width: 390, height: 844 })
    await page.getByText('С помощью ИИ').scrollIntoViewIfNeeded()
    await expect(page.getByText('С помощью ИИ')).toBeVisible()
    await page.getByText('10:16:47').first().scrollIntoViewIfNeeded()
    await expect(page.getByText('10:16:47').first()).toBeVisible()
    const table = page.getByRole('table')
    await expect(
      table.locator('tbody tr').filter({ hasText: 'Выполнено' })
    ).toHaveCount(50)
    await expect(page.getByText('Otvetstvennyy')).toHaveCount(0)
    const summary = page.locator('summary', { hasText: 'Подробнее' })
    await summary.scrollIntoViewIfNeeded()
    await summary.click()
    await expect(
      page.getByText('9f890e10-e92c-441c-b548-178d65cc9f56')
    ).toBeVisible()
    await expect(page.getByRole('dialog').getByRole('link')).toHaveCount(0)
    if (!mobile) {
      await page.setViewportSize({ width: 1920, height: 1000 })
      await table.locator('td').first().scrollIntoViewIfNeeded()
      await page.screenshot({
        path: testInfo.outputPath('document-history.png'),
      })
    }
    await table.locator('tbody tr').last().scrollIntoViewIfNeeded()
    await expect.poll(() => requested).toEqual([0, 1])
    // Beyond 50 rows the shared table virtualizes; assert the last record, not DOM count.
    await expect
      .poll(
        async () => {
          await page.evaluate(`(() => {
        const dialog = document.querySelector('[role=dialog]');
        for (const element of dialog.querySelectorAll('div')) {
          if (getComputedStyle(element).overflowY === 'auto' && element.scrollHeight > element.clientHeight)
            element.scrollTop = element.scrollHeight
        }
      })()`)
          return page.getByText('Запись 51', { exact: true }).count()
        },
        { timeout: 10000 }
      )
      .toBe(1)
    await page.getByText('Запись 51', { exact: true }).scrollIntoViewIfNeeded()
    await expect(page.getByText('Запись 51', { exact: true })).toBeVisible()
    expect(requested).toEqual([0, 1])
  })
}
