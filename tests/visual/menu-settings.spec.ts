import { expect, test } from '@playwright/test'
import { mockApi } from './helpers/mock-api'

/**
 * SCRUM-426: сквозной прогон вкладки «Настройка модулей» в конструкторе дизайна —
 * переход по вкладкам, раскрытие модуля кликом по строке, тумблер видимости,
 * drag-n-drop перестановка, сохранение. Ловит зависания рендера и ошибки консоли.
 */

const structure = {
  patch: {},
  modules: [
    {
      key: 'module:Administrirovanie',
      code: 'Administrirovanie',
      nameRu: 'Администрирование',
      nameKz: null,
      iconCode: 'admin',
      effectiveHidden: false,
      sections: [
        {
          key: 'section:Administrirovanie/bezopasnost',
          nameRu: 'Безопасность',
          nameKz: null,
          effectiveHidden: false,
          elements: [
            {
              key: 'element:Administrirovanie/bezopasnost/ZhurnalRegistratsii',
              nameRu: 'Журнал регистрации',
              nameKz: null,
              effectiveHidden: false,
            },
            {
              key: 'element:Administrirovanie/bezopasnost/NastroykaMenyu',
              nameRu: 'Настройка меню',
              nameKz: null,
              effectiveHidden: false,
            },
          ],
        },
      ],
    },
    {
      key: 'module:BankiIKassy',
      code: 'BankiIKassy',
      nameRu: 'Банк и касса',
      nameKz: null,
      iconCode: 'bank',
      effectiveHidden: false,
      sections: [
        {
          key: 'section:BankiIKassy/kassa',
          nameRu: 'Касса',
          nameKz: null,
          effectiveHidden: false,
          elements: [
            {
              key: 'element:BankiIKassy/kassa/PKO',
              nameRu: 'Приходный кассовый ордер',
              nameKz: null,
              effectiveHidden: false,
            },
            {
              key: 'element:BankiIKassy/kassa/RKO',
              nameRu: 'Расходный кассовый ордер',
              nameKz: null,
              effectiveHidden: false,
            },
            // Дубли кода в сиде (реальный случай: два ЭСФ в «Складе») — рендер
            // не должен размножать строки при дублирующихся ключах.
            {
              key: 'element:BankiIKassy/kassa/ESF',
              nameRu: 'Электронные счета-фактуры',
              nameKz: null,
              effectiveHidden: false,
            },
            {
              key: 'element:BankiIKassy/kassa/ESF',
              nameRu: 'Электронные счета-фактуры',
              nameKz: null,
              effectiveHidden: false,
            },
          ],
        },
      ],
    },
  ],
}

test('настройка модулей: вкладка, раскрытие, тумблер, dnd, сохранение', async ({
  page,
}) => {
  const pageErrors: string[] = []
  page.on('pageerror', (err) => pageErrors.push(String(err)))
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.addInitScript(`
    localStorage.setItem('webbuh.auth.accessToken', 'visual-fixture-only');
    localStorage.setItem('webbuh.auth.user', JSON.stringify({id:1,login:'Тест',displayName:'Тест',userKind:'INTERNAL',language:'Ru',supportAgent:false}));
  `)
  const savedPatches: unknown[] = []
  await mockApi(page, {
    'POST /api/view#OPEN': {},
    'GET /api/settings/modules': { data: [], success: true },
    'GET /api/tasks/active': [],
    'GET /api/support/calls/active': { __status: 204, __body: null },
    'GET /api/ai-assistant/settings': {
      data: { enabled: false, capabilities: [] },
      success: true,
    },
    'GET /api/view-settings-admin/screens': { data: [], success: true },
    'GET /api/view-settings-profile-defaults/profiles': {
      data: [],
      success: true,
    },
    'GET /api/menu-settings/me': { data: { canManage: true }, success: true },
    'GET /api/menu-settings/structure': { data: structure, success: true },
    'GET /api/menu-settings/profiles': {
      data: [{ code: 'p1', name: 'Бухгалтер' }],
      success: true,
    },
    'GET /api/menu-settings/users': {
      data: [{ key: '7', name: 'Тест Юзер' }],
      success: true,
    },
    'PUT /api/menu-settings/global': { data: { patch: {} }, success: true },
    'PUT /api/menu-settings/my': { data: { patch: {} }, success: true },
    'GET /api/menu-settings/presets': {
      data: [
        {
          id: 5,
          name: 'Меню кассира',
          authorName: 'Коллега',
          mine: false,
          updatedAt: '2026-09-25T10:00:00',
        },
      ],
      success: true,
    },
    'GET /api/menu-settings/presets/5': {
      data: { patch: { 'module:BankiIKassy': { hidden: true } } },
      success: true,
    },
    'POST /api/menu-settings/presets': {
      data: {
        id: 6,
        name: 'Мой набор',
        authorName: 'Тест',
        mine: true,
        updatedAt: '2026-09-25T10:00:00',
      },
      success: true,
    },
  })
  page.on('request', (req) => {
    if (req.method() === 'PUT' && req.url().includes('/api/menu-settings/')) {
      savedPatches.push(req.postDataJSON())
    }
  })

  // Реестр форм открывается на вкладке «Конструктор дизайна», переключаемся.
  await page.goto('/admin/design-constructor')
  await page.getByRole('tab', { name: 'Настройка модулей' }).click()
  await expect(page).toHaveURL(/tab=menu/)

  // Дерево загрузилось.
  await expect(page.getByText('Банк и касса')).toBeVisible({ timeout: 10000 })

  // Раскрытие модуля кликом по строке; элементы — за вторым аккордеоном секции
  // (Администрирование несёт 700+ ссылок — всё разом не рендерим).
  await page.getByRole('button', { name: 'Раскрыть: Банк и касса' }).click()
  await expect(page.getByText('Касса', { exact: true })).toBeVisible({
    timeout: 5000,
  })
  await expect(page.getByText('Приходный кассовый ордер')).toHaveCount(0)
  await page.getByRole('button', { name: 'Раскрыть: Касса' }).click()
  await expect(page.getByText('Приходный кассовый ордер')).toBeVisible()

  // Дубли кода из сида рендерятся по одному разу каждый — ровно 2 строки.
  await expect(page.getByText('Электронные счета-фактуры')).toHaveCount(2)

  // Drag-n-drop: РКО перед ПКО внутри секции.
  const rko = page
    .locator('div[draggable="true"]')
    .filter({ hasText: /^Расходный кассовый ордер/ })
  const pko = page
    .locator('div[draggable="true"]')
    .filter({ hasText: /^Приходный кассовый ордер/ })
  await rko.dragTo(pko)
  // После dnd дубли по-прежнему не размножены.
  await expect(page.getByText('Электронные счета-фактуры')).toHaveCount(2)

  // Тумблер видимости модуля.
  await page
    .getByRole('button', { name: 'Скрыть или показать: Банк и касса' })
    .click()
  await expect(page.getByText('Администрирование')).toBeVisible({
    timeout: 3000,
  })

  // У «Настройки меню» тумблера нет (защита от самоотстрела).
  await expect(
    page.getByRole('button', { name: 'Скрыть или показать: Настройка меню' })
  ).toHaveCount(0)

  // Сохранение уходит PUT'ом с ожидаемым патчем (dnd + скрытие).
  const put = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().includes('/api/menu-settings/global')
  )
  await page.getByRole('button', { name: 'Сохранить' }).click()
  await put
  expect(savedPatches).toHaveLength(1)
  expect(savedPatches[0]).toEqual({
    patch: {
      'module:BankiIKassy': { hidden: true },
      'element:BankiIKassy/kassa/RKO': { order: 0 },
      'element:BankiIKassy/kassa/PKO': { order: 1 },
      // Дубль кода схлопывается в одну запись с последней позицией.
      'element:BankiIKassy/kassa/ESF': { order: 3 },
    },
  })

  // Пресеты: публикация текущего черновика под именем.
  await page.getByRole('button', { name: 'Поделиться' }).click()
  await page.getByLabel('Название пресета').fill('Мой набор')
  const publish = page.waitForRequest(
    (r) =>
      r.method() === 'POST' && r.url().includes('/api/menu-settings/presets')
  )
  await page.getByRole('button', { name: 'Опубликовать' }).click()
  const publishReq = await publish
  expect(publishReq.postDataJSON()).toMatchObject({ name: 'Мой набор' })

  // Каталог: применение чужого пресета уходит PUT'ом в ЛИЧНЫЙ слой.
  await page.getByRole('button', { name: 'Пресеты' }).click()
  await expect(page.getByText('Меню кассира')).toBeVisible()
  const applyPut = page.waitForRequest(
    (r) => r.method() === 'PUT' && r.url().includes('/api/menu-settings/my')
  )
  await page.getByRole('button', { name: 'Применить' }).click()
  const applied = await applyPut
  expect(applied.postDataJSON()).toEqual({
    patch: { 'module:BankiIKassy': { hidden: true } },
  })

  expect(pageErrors, `pageerror: ${pageErrors.join('\n')}`).toEqual([])
  const relevant = consoleErrors.filter((e) => !e.includes('favicon'))
  expect(relevant, `console: ${relevant.join('\n')}`).toEqual([])
})
