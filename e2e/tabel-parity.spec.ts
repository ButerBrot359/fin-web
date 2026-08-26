import { expect, test } from '@playwright/test'

// Local controlled Tabel fixture.  The SDUI route contract requires the numeric
// document entry id, not the human-readable document number.
const tabelRoute = '/modules/ZarplatiIKadri/document/Tabel/27855652'

test.describe.serial('Tabel strict 1C parity smoke', () => {
  test('keeps the observed command surface, confirmations, and compact matrix display', async ({
    page,
  }) => {
    await page.goto(tabelRoute)
    await expect(
      page.getByRole('heading', { name: /Табель AAI00-00001/ })
    ).toBeVisible()

    await expect(
      page.getByRole('button', { name: 'Провести', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Провести и закрыть' })
    ).toBeEnabled()

    await page.getByText('Ещё', { exact: true }).click()
    await expect(
      page.getByRole('menuitem', { name: 'Провести и закрыть' })
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: 'Отменить проведение' })
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', {
        name: 'Табель учета рабочего времени',
        exact: true,
      })
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: /Отчеты: Движения документа/ })
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: 'Связанные документы', exact: true })
    ).toHaveCount(0)
    await expect(
      page.getByRole('menuitem', { name: 'Выбрать период', exact: true })
    ).toHaveCount(1)
    await expect(
      page.getByRole('menuitem', {
        name: 'Перезаполнить текущего сотрудника',
        exact: true,
      })
    ).toHaveCount(1)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Заполнить' }).click()
    await page.getByRole('menuitem', { name: 'Заполнить', exact: true }).click()
    await expect(
      page.getByText(
        'Табель будет перезаполнен по кадровым данным. Продолжить?'
      )
    ).toBeVisible()
    await page.getByRole('button', { name: 'Нет', exact: true }).click()

    await page.getByRole('button', { name: 'Очистить' }).click()
    await expect(
      page.getByText('Табель будет очищена. Продолжить?')
    ).toBeVisible()
    await page.getByRole('button', { name: 'Нет', exact: true }).click()

    const matrix = page.getByTestId('tabel-matrix')
    await expect(matrix).toBeVisible()
    await expect(matrix.getByText('Итого', { exact: true })).toBeVisible()
    await expect(
      matrix.getByRole('columnheader', { name: '01 Сб', exact: true })
    ).toBeVisible()
    await expect(
      matrix.getByRole('columnheader', { name: '02 Вс', exact: true })
    ).toBeVisible()
    await expect(matrix.getByText('8.0000', { exact: true })).toHaveCount(0)
    await expect(matrix.locator('input').first()).toHaveValue(
      /^(|[0-9]+(?:[.,][0-9]+)?)$/
    )
  })
})
