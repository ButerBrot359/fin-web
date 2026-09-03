import { expect, test } from '@playwright/test'

import { freezeTime } from './helpers/freeze'
import { loadFixture } from './helpers/load-fixture'
import { mockApi } from './helpers/mock-api'

/**
 * Два состояния поверх уже покрытых экранов (screens-cards / screens-
 * legacy-and-reports): диалог «Сохранить изменения?» при закрытии грязной
 * вкладки, поповер опций автокомплита.
 */
test.beforeEach(async ({ page }) => {
  await freezeTime(page)
})

test('диалог «Сохранить изменения?» при закрытии грязной вкладки', async ({
  page,
}) => {
  // dirty — серверный (SCRUM-288 §2.5), не локальный: EVENT на blur текстового
  // поля должен вернуть formDirty:true, иначе диалог не появится (см. добавленный
  // ключ 'POST /api/view#EVENT' в otpusk-card.json, README). Поле — «Основание»
  // (вкладка «Условия»), не «Комментарий»: у последнего в снятой фикстуре
  // maxLength:0, что рендерится как HTML maxlength=0 и блокирует ввод целиком.
  await mockApi(page, loadFixture('otpusk-card.json'))
  await page.goto('/modules/ZarplatiIKadri/document/Otpusk/27857683')

  await page.getByRole('tab', { name: 'Условия' }).click()
  const field = page.getByLabel('Основание', { exact: true })
  await field.fill('черновой комментарий')
  const eventResponse = page.waitForResponse((r) => {
    if (!r.url().includes('/api/view')) return false
    const body = r.request().postDataJSON() as {
      action?: { type?: string }
    } | null
    return body?.action?.type === 'EVENT'
  })
  await field.blur()
  await eventResponse

  // Крестик закрытия виден только при наведении (компонент-шит Tab, Ф4):
  // сначала hover по вкладке, затем клик по крестику — как делает пользователь.
  const tabButton = page.getByRole('button', { name: /Отпуск/ })
  await tabButton.hover()
  await tabButton.locator('[role="button"]').click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByText('Сохранить изменения?')).toBeVisible()
  await expect(page).toHaveScreenshot('unsaved-dialog.png')
})

test('поповер опций автокомплита «Организация» на ОСВ', async ({ page }) => {
  await mockApi(page, loadFixture('osv-tree.json'))
  await page.goto('/modules/Otchety/reportalt/OborotnoSaldovayaVedomost')

  const orgField = page.locator('.MuiAutocomplete-root', {
    has: page.getByRole('combobox', { name: 'Организация' }),
  })
  await orgField.getByRole('button', { name: 'Open' }).click()

  await expect(
    page.getByRole('option', { name: /Демонстрационная организация/ })
  ).toBeVisible()
  await expect(page).toHaveScreenshot('autocomplete-popover.png')
})
