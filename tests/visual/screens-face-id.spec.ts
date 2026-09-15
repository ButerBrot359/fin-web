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
        registered: false,
        profile: null,
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
