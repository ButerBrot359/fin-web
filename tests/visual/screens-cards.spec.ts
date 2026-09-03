import { expect, test } from '@playwright/test'

import { freezeTime } from './helpers/freeze'
import { loadFixture } from './helpers/load-fixture'
import { mockApi } from './helpers/mock-api'

/**
 * Опорные экраны без дополнительных сетевых шагов после первого OPEN:
 * страница модуля, карточка документа с ТЧ, табель-матрица, карточка
 * справочника. Экраны с легаси-дверью / отчётами (клик «Сформировать») —
 * в screens-legacy-and-reports.spec.ts, стейты поверх этих же экранов —
 * в screens-states.spec.ts.
 */
test.beforeEach(async ({ page }) => {
  await freezeTime(page)
})

test('страница модуля (SDUI) — Зарплата и кадры', async ({ page }) => {
  await mockApi(page, loadFixture('shell-module.json'))
  await page.goto('/modules/ZarplatiIKadri')

  await expect(
    page.getByText('Приемы на работу', { exact: true })
  ).toBeVisible()
  await expect(page).toHaveScreenshot('shell-module.png')
})

test('карточка документа с ТЧ (Отпуск) — вкладка Сотрудники', async ({
  page,
}) => {
  await mockApi(page, loadFixture('otpusk-card.json'))
  await page.goto('/modules/ZarplatiIKadri/document/Otpusk/27857683')

  await page.getByRole('tab', { name: 'Сотрудники' }).click()
  await expect(
    page.getByRole('columnheader', { name: /Сотрудник/ }).first()
  ).toBeVisible()
  await expect(page).toHaveScreenshot('otpusk-card.png')
})

test('табель-матрица — 3 сотрудника', async ({ page }) => {
  await mockApi(page, loadFixture('tabel-card.json'))
  await page.goto('/modules/ZarplatiIKadri/document/Tabel/27858509')

  await expect(page.getByText('Жанар физ лицо')).toBeVisible()
  await expect(page).toHaveScreenshot('tabel-matrix.png')
})

test('карточка справочника (Графики работы)', async ({ page }) => {
  await mockApi(page, loadFixture('kalendari-card.json'))
  await page.goto('/dictionaries/Kalendari/49237')

  await expect(
    page.getByRole('heading', {
      name: 'Пятидневка - 36 часов (7,2 ч) (График работы)',
    })
  ).toBeVisible()
  await expect(page).toHaveScreenshot('dictionary-card.png')
})
