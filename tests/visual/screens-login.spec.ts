import { expect, test } from '@playwright/test'

import { freezeTime } from './helpers/freeze'
import { mockApi } from './helpers/mock-api'
import { stableScreenshot } from './helpers/stable-screenshot'

/**
 * Окно авторизации по Figma 545:22859 (чек-лист, пачка 8): сцена ui-02 с
 * иллюстрацией, карточка входа, состояние ошибки. Роут /login живёт вне
 * Layout и рендерится и в прод-сборке (AUTH_ENABLED выключен — гвард
 * прозрачен, но сама страница по прямому URL работает).
 */
test.beforeEach(async ({ page }) => {
  await freezeTime(page)
})

test('окно авторизации — дефолтное состояние', async ({ page }) => {
  await mockApi(page, {})
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: 'Вход' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Войти', exact: true })
  ).toBeVisible()
  // Прямой скрин + toMatchSnapshot: стабилизатор toHaveScreenshot стабильно
  // терял слой ламп (см. коммент у <img> в login-page) — ретраим-до-стабильного
  // кадра сами (stableScreenshot).
  expect(await stableScreenshot(page)).toMatchSnapshot('login-default.png', {
    maxDiffPixelRatio: 0.001,
    maxDiffPixels: 400,
  })
})

test('низкое окно: карточка досягаема скроллом (html/body overflow hidden)', async ({
  page,
}) => {
  await mockApi(page, {})
  await page.setViewportSize({ width: 1440, height: 560 })
  await page.goto('/login')
  const submit = page.getByRole('button', { name: 'Войти', exact: true })
  // scrollIntoViewIfNeeded прокручивает ВНУТРЕННИЙ контейнер страницы:
  // документ заблокирован overflow:hidden, скроллит обёртка /login.
  await submit.scrollIntoViewIfNeeded()
  await expect(submit).toBeInViewport()
})

test('окно авторизации — ошибка входа', async ({ page }) => {
  await mockApi(page, {
    'POST /api/auth/login': {
      __status: 401,
      __body: { message: 'Неверный логин или пароль' },
    },
  })
  await page.goto('/login')
  await page.getByLabel('Пользователь').fill('demo')
  await page.getByLabel('Пароль', { exact: true }).fill('wrong')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByText('Неверный логин или пароль')).toBeVisible()
  expect(await stableScreenshot(page)).toMatchSnapshot('login-error.png', {
    maxDiffPixelRatio: 0.001,
    maxDiffPixels: 400,
  })
})
