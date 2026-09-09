import { expect, test } from '@playwright/test'

import { freezeTime } from './helpers/freeze'
import { loadFixture } from './helpers/load-fixture'
import { mockApi } from './helpers/mock-api'

/**
 * Экраны, требующие шаг после первого OPEN:
 * - легаси-список документов — OPEN отвечает 422 (SCREEN_NOT_SDUI),
 *   фронт сам уходит на легаси-двери (document-types/columns/search);
 * - отчёты (ОСВ, Карточка счёта) — параметры уже в state OPEN, клик
 *   «Сформировать» шлёт COMMAND, ответ патчит `source` результата,
 *   фронт сам дёргает POST /api/reportalt/<report>/run.
 */
test.beforeEach(async ({ page }) => {
  await freezeTime(page)
})

test('легаси-список документов (Перемещение ВНА)', async ({ page }) => {
  await mockApi(page, loadFixture('document-list-vna.json'))
  await page.goto(
    '/modules/OsiNma/document/PeremeshchenieOS?skipDependsOn=true'
  )

  await expect(page.getByText('ПРФ00-00005').first()).toBeVisible()
  await expect(page).toHaveScreenshot('document-list.png')
})

test('ОСВ — дерево результата после «Сформировать»', async ({ page }) => {
  await mockApi(page, loadFixture('osv-tree.json'))
  await page.goto('/modules/Otchety/reportalt/OborotnoSaldovayaVedomost')

  await page.getByRole('button', { name: 'Сформировать' }).click()
  await expect(page.getByText('Сальдо на начало, Дт')).toBeVisible()
  await expect(page).toHaveScreenshot('report-tree.png')
})

test('Карточка счёта — результат после «Сформировать»', async ({ page }) => {
  await mockApi(page, loadFixture('kartochka-ledger.json'))
  await page.goto('/modules/Otchety/reportalt/KartochkaScheta')

  await page.getByRole('button', { name: 'Сформировать' }).click()
  await expect(page.getByText('Содержание операции')).toBeVisible()
  await expect(page).toHaveScreenshot('report-ledger.png')
})
