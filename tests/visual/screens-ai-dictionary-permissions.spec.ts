import { expect, test, type Page } from '@playwright/test'
import { mockApi } from './helpers/mock-api'

async function permissionServer(page: Page) {
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
    'GET /api/analytics/ai-settings': {
      data: { enabled: true },
      success: true,
    },
  })
  const rows = [
    {
      typeCode: 'Valyuty',
      nameRu: 'Валюты',
      nameKz: 'Валюталар',
      allowed: false,
    },
    {
      typeCode: 'EdinitsyIzmereniya',
      nameRu: 'Единицы измерения',
      nameKz: 'Өлшем бірліктері',
      allowed: false,
    },
    {
      typeCode: 'Kontragenty',
      nameRu: 'Контрагенты',
      nameKz: 'Контрагенттер',
      allowed: false,
    },
    ...Array.from({ length: 100 }, (_, index) => ({
      typeCode: `fixture${String(index)}`,
      nameRu: `Тестовый справочник ${String(index)}`,
      nameKz: null,
      allowed: false,
    })),
  ]
  const changes: { typeCode: string; allowed: boolean }[] = []
  let failNext = false
  await page.route(
    '**/api/analytics/ai-settings/dictionary-permissions**',
    async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (request.method() === 'PUT') {
        const typeCode = decodeURIComponent(url.pathname.split('/').at(-1)!)
        const body = request.postDataJSON() as { allowed: boolean }
        if (failNext) {
          failNext = false
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Не удалось сохранить разрешение',
              success: false,
            }),
          })
        }
        const row = rows.find((item) => item.typeCode === typeCode)!
        row.allowed = body.allowed
        changes.push({ typeCode, ...body })
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: row, success: true }),
        })
      }
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const filtered = rows.filter((row) =>
        `${row.typeCode} ${row.nameRu} ${row.nameKz ?? ''}`
          .toLowerCase()
          .includes(q)
      )
      const pageNumber = Number(url.searchParams.get('page') ?? 0)
      const size = Number(url.searchParams.get('size') ?? 50)
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            items: filtered.slice(pageNumber * size, (pageNumber + 1) * size),
            page: pageNumber,
            size,
            totalElements: filtered.length,
            allowedCount: rows.filter((row) => row.allowed).length,
            maxValuesPerDictionary: 50,
            maxValueLength: 120,
          },
          success: true,
        }),
      })
    }
  )
  return {
    changes,
    fail: () => {
      failNext = true
    },
  }
}

test('dictionary permissions persist, search and paginate without granting other types', async ({
  page,
}, info) => {
  const state = await permissionServer(page)
  await page.goto('/modules/Main/analytics/dictionary-permissions')
  const currency = page
    .getByTestId('dictionary-permission-Valyuty')
    .getByRole('checkbox')
  await expect(currency).not.toBeChecked()
  await currency.click()
  await expect(currency).toBeChecked()
  await expect.poll(() => state.changes.length).toBe(1)
  expect(state.changes).toEqual([{ typeCode: 'Valyuty', allowed: true }])
  await page.reload()
  await expect(currency).toBeChecked()
  await expect(
    page
      .getByTestId('dictionary-permission-EdinitsyIzmereniya')
      .getByRole('checkbox')
  ).not.toBeChecked()
  await page.getByTestId('dictionary-permission-next').click()
  await expect(
    page.getByTestId('dictionary-permission-fixture47')
  ).toBeVisible()
  await page.getByTestId('dictionary-permission-search').fill('Валюты')
  await expect(currency).toBeVisible()
  await expect(page.getByTestId('dictionary-permission-fixture47')).toHaveCount(
    0
  )
  await page.screenshot({
    path: info.outputPath('dictionary-permissions.png'),
    fullPage: true,
  })
  state.fail()
  await currency.click()
  await expect(
    page.getByRole('alert').filter({ hasText: /Не удалось/ })
  ).toBeVisible()
  await expect(currency).toBeChecked()
  expect(state.changes).toHaveLength(1)
  await currency.click()
  await expect(currency).not.toBeChecked()
  await expect.poll(() => state.changes.length).toBe(2)
  await page.reload()
  await expect(currency).not.toBeChecked()
})

test('dictionary permissions fit a mobile viewport', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await permissionServer(page)
  await page.goto('/analytics/dictionary-permissions')
  const row = page.getByTestId('dictionary-permission-Valyuty')
  await expect(row).toBeVisible()
  const box = await row.boundingBox()
  expect(box!.y + box!.height).toBeLessThanOrEqual(844)
  await row.getByRole('checkbox').click()
  await expect(row.getByRole('checkbox')).toBeChecked()
  expect(
    await page.evaluate('document.documentElement.scrollWidth')
  ).toBeLessThanOrEqual(390)
  await page.screenshot({
    path: info.outputPath('dictionary-permissions-mobile.png'),
    fullPage: false,
  })
})
