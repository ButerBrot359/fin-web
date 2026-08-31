import { cleanup, render, renderHook } from '@testing-library/react'
import type { CellContext, ColumnDef } from '@tanstack/react-table'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ColumnMetaDto } from '@/shared/lib/eav'
import { useInformationRegisterColumns } from './use-information-register-columns'
import type { InformationRegisterEntry } from '../../types/information-register'

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
  column: ColumnDef<InformationRegisterEntry>
): ((row: InformationRegisterEntry, index: number) => unknown) =>
  (
    column as ColumnDef<InformationRegisterEntry> & {
      accessorFn: (row: InformationRegisterEntry, index: number) => unknown
    }
  ).accessorFn

const meta = (code: string): ColumnMetaDto =>
  ({ code, nameRu: code, dataType: 'STRING' }) as ColumnMetaDto

const columnsFor = (codes: string[]) => {
  const { result } = renderHook(() =>
    useInformationRegisterColumns([], codes.map(meta))
  )
  return result.current
}

describe('колонка «Регистратор» регистра сведений', () => {
  afterEach(cleanup)

  // Гейт системных колонок читает коды из /columns. Контрактный код колонки —
  // recorderDocumentName; по старому (recorderDocumentEntryId) колонка не
  // отрисовалась бы вовсе.
  it('рендерится по коду recorderDocumentName из /columns', () => {
    expect(
      columnsFor(['period', 'recorderDocumentName']).map((c) => c.id)
    ).toEqual(['period', 'recorderDocumentName'])
  })

  it('без системной колонки в /columns регистратора нет', () => {
    expect(columnsFor(['period']).map((c) => c.id)).toEqual(['period'])
  })

  it('печатает представление документа, а не его id', () => {
    const column = columnsFor(['recorderDocumentName'])[0]
    const entry = {
      id: 1,
      attributes: null,
      recorderDocumentName: 'Начисление зарплаты сотрудникам AAY00-00001',
      recorderDocumentEntryId: 27858300,
    } as InformationRegisterEntry

    const value = accessorOf(column)(entry, 0)
    expect(value).toBe('Начисление зарплаты сотрудникам AAY00-00001')

    const cell = column.cell as (
      ctx: CellContext<InformationRegisterEntry, unknown>
    ) => React.ReactElement
    const { container } = render(
      cell({ getValue: () => value } as CellContext<
        InformationRegisterEntry,
        unknown
      >)
    )
    expect(container.textContent).toBe(
      'Начисление зарплаты сотрудникам AAY00-00001'
    )
  })
})
