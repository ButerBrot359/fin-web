import { cleanup, render, renderHook } from '@testing-library/react'
import type { CellContext, ColumnDef } from '@tanstack/react-table'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAccumulationRegisterColumns } from './use-accumulation-register-columns'
import type { AccumulationRegisterEntry } from '../../types/accumulation-register'

// Перевод не предмет теста, а инициализация i18n тянет весь конфиг приложения.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'ru' } }),
  initReactI18next: { type: 'backend', init: () => undefined },
}))

/**
 * `ColumnDef` — объединение (accessor / display / group), и `accessorFn` есть
 * не у каждого члена. Колонки этого хука — accessor-колонки, сужаем на месте.
 */
const accessorOf = (
  column: ColumnDef<AccumulationRegisterEntry>
): ((row: AccumulationRegisterEntry, index: number) => unknown) =>
  (
    column as ColumnDef<AccumulationRegisterEntry> & {
      accessorFn: (row: AccumulationRegisterEntry, index: number) => unknown
    }
  ).accessorFn

const recorderColumn = (): ColumnDef<AccumulationRegisterEntry> => {
  const { result } = renderHook(() => useAccumulationRegisterColumns([]))
  const column = result.current.find((c) => c.id === 'recorderDocumentName')
  expect(column).toBeTruthy()
  return column!
}

const cellText = (
  column: ColumnDef<AccumulationRegisterEntry>,
  value: unknown
): string => {
  const cell = column.cell as (
    ctx: CellContext<AccumulationRegisterEntry, unknown>
  ) => React.ReactElement
  const { container } = render(
    cell({ getValue: () => value } as CellContext<
      AccumulationRegisterEntry,
      unknown
    >)
  )
  return container.textContent
}

const row = (
  overrides: Partial<AccumulationRegisterEntry>
): AccumulationRegisterEntry =>
  ({ id: 1, attributes: null, ...overrides }) as AccumulationRegisterEntry

describe('колонка «Регистратор» регистра накопления', () => {
  afterEach(cleanup)

  // Дефект: во всех строках печаталось «#27858300» — по такой строке не понять,
  // откуда движение. Представление документа приходит готовым полем строки.
  it('берёт представление документа, а не его id', () => {
    const column = recorderColumn()
    const accessor = accessorOf(column)
    const entry = row({
      recorderDocumentName:
        'Начисление зарплаты сотрудникам AAY00-00001 от 31.07.2026 12:00:00',
      recorderDocumentEntryId: 27858300,
    })

    expect(accessor(entry, 0)).toBe(
      'Начисление зарплаты сотрудникам AAY00-00001 от 31.07.2026 12:00:00'
    )
    expect(cellText(column, accessor(entry, 0))).toBe(
      'Начисление зарплаты сотрудникам AAY00-00001 от 31.07.2026 12:00:00'
    )
  })

  // Ручная корректировка без регистратора: пустая ячейка, а не «#id».
  it('без регистратора ячейка пустая', () => {
    const column = recorderColumn()
    const entry = row({ recorderDocumentName: null })

    expect(accessorOf(column)(entry, 0)).toBeNull()
    expect(cellText(column, null)).toBe('')
  })
})
