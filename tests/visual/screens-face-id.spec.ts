import { expect, test, type Page } from '@playwright/test'

import { freezeTime } from './helpers/freeze'
import { mockApi } from './helpers/mock-api'

async function setup(page: Page) {
  await freezeTime(page)
  await page.addInitScript(() => {
    localStorage.setItem('webbuh.auth.accessToken', 'visual-fixture-only')
    localStorage.setItem(
      'sidebar-settings',
      JSON.stringify({ isCollapsed: true })
    )
    localStorage.setItem(
      'webbuh.auth.user',
      JSON.stringify({
        id: 7,
        login: 'test-accountant',
        displayName: 'Тестовый пользователь',
        userKind: 'INTERNAL',
        language: 'Ru',
        mustChangePassword: false,
        supportAgent: false,
      })
    )
  })
  await mockApi(page, {
    'POST /api/view#OPEN': {},
    'GET /api/settings/modules': { data: [], success: true },
    'GET /api/tasks/active': [],
    'GET /api/users/123/face-id': {
      data: {
        userEntryId: 123,
        userName: 'Тестовый сотрудник',
        accountAvailable: true,
        canManage: true,
        canReplace: false,
        registered: false,
        profile: null,
      },
    },
    'GET /api/me/face-id': {
      data: {
        userEntryId: 123,
        userName: 'Тестовый пользователь',
        accountAvailable: true,
        canManage: true,
        canReplace: true,
        registered: true,
        profile: {
          id: 'profile-1',
          subject: 'webbuh:7',
          source: 'trusted_photo',
          created: null,
        },
      },
    },
    'GET /api/admin/face-id-settings': {
      data: {
        enabled: false,
        configured: true,
        experimentalAuthenticationAllowed: true,
        serviceUrl: 'https://faceid.qazyna.ai',
        callbackUrl: 'https://dev.qazyna.ai/auth/face-id/callback',
        managementMode: 'AUTHENTICATED',
      },
    },
  })
}

test('Face ID user photo page displays selected person and consent', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/admin/users/123/face-id')
  await expect(
    page.getByText('Тестовый сотрудник', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Добавить лицо', exact: true })
  ).toBeDisabled()
  await expect(page.getByRole('checkbox')).not.toBeChecked()
  await expect(page).toHaveScreenshot('face-id-user.png')
})

test('Face ID settings require deliberate change and reason', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/admin/face-id-settings')
  await expect(page.getByRole('switch')).not.toBeChecked()
  await expect(
    page.getByRole('button', { name: 'Сохранить настройку' })
  ).toBeDisabled()
  await expect(page).toHaveScreenshot('face-id-settings.png')
})

test('Face ID invalid callback removes query and offers a new login', async ({
  page,
}) => {
  await freezeTime(page)
  await mockApi(page, {})
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/face-id/complete'))
      requests.push(request.url())
  })
  await page.goto('/auth/face-id/callback?code=unbound-test&state=unbound-test')
  await expect(
    page.getByRole('button', { name: 'Вернуться ко входу' })
  ).toBeVisible()
  await expect(page).toHaveURL(/\/auth\/face-id\/callback$/)
  expect(requests).toEqual([])
  await expect(page).toHaveScreenshot('face-id-callback.png')
})

test('personal menu retains legacy photo and opens the Face ID self page', async ({
  page,
}) => {
  await setup(page)
  await page.goto('/admin/users/123/face-id')
  await expect(
    page.getByText('Тестовый сотрудник', { exact: true })
  ).toBeVisible()
  await page.getByRole('button', { name: 'Меню пользователя' }).click()
  await expect(
    page.getByRole('menuitem', { name: 'Фото для входа по лицу', exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole('menuitem', {
      name: 'Фото для входа по Face ID',
      exact: true,
    })
  ).toBeVisible()
  await expect(page).toHaveScreenshot('face-id-user-menu.png')
  await page
    .getByRole('menuitem', { name: 'Фото для входа по Face ID', exact: true })
    .click()
  await expect(page).toHaveURL(/\/profile\/face-id$/)
  await expect(
    page.getByRole('button', { name: 'Заменить фото' })
  ).toBeVisible()
  await expect(page).toHaveScreenshot('face-id-self.png')
})

test('personal replacement requires a new preview and consent before its PUT', async ({
  page,
}) => {
  await setup(page)
  const writes: unknown[] = []
  await page.route('**/api/me/face-id', async (route) => {
    if (route.request().method() !== 'PUT') return route.fallback()
    writes.push(route.request().postDataJSON())
    return route.fulfill({
      status: 422,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 422,
        message: 'Rejected synthetic image',
      }),
    })
  })
  await page.goto('/profile/face-id')
  await page.getByRole('button', { name: 'Заменить фото' }).click()
  await page
    .getByLabel('Выбрать фото', { exact: true })
    .setInputFiles('tests/visual/assets/face-id-synthetic.png')
  await expect(
    page.getByRole('img', {
      name: 'Фото выбранного пользователя перед сохранением',
    })
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Сохранить новое фото' })
  ).toBeDisabled()
  await page.getByRole('checkbox').check()
  await expect(page).toHaveScreenshot('face-id-self-replacement.png')
  await page.getByRole('button', { name: 'Сохранить новое фото' }).click()
  await expect(
    page.getByText(
      'Новое фото не прошло проверку. Для входа по-прежнему используется ранее добавленное фото. Выберите другое фото.'
    )
  ).toBeVisible()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toEqual({
    image: expect.any(String),
    consent: true,
    expectedProfileId: 'profile-1',
  })
  await expect(page).toHaveScreenshot('face-id-replacement-rejected.png')
})

test('replacement remains unavailable when the server denies canReplace', async ({
  page,
}) => {
  await setup(page)
  await page.route('**/api/me/face-id', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          userEntryId: 123,
          userName: 'Тестовый пользователь',
          accountAvailable: true,
          canManage: true,
          canReplace: false,
          registered: true,
          profile: {
            id: 'profile-1',
            subject: 'webbuh:7',
            source: 'trusted_photo',
            created: null,
          },
        },
      }),
    })
  )
  await page.goto('/profile/face-id')
  await expect(
    page.getByRole('button', { name: 'Заменить фото' })
  ).toBeDisabled()
  await expect(
    page.getByText('Замена фото недоступна для вашей учётной записи.')
  ).toBeVisible()
  await expect(page).toHaveScreenshot('face-id-replacement-forbidden.png')
})
