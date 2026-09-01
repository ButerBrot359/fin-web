import { describe, expect, it } from 'vitest'

import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'
import { findAutoAdvanceColumn } from './table-auto-advance'

const col = (
  binding: string,
  overrides: Partial<TableColumnDef> = {}
): TableColumnDef => ({
  id: `col.${binding}`,
  label: binding,
  binding,
  cellWidget: 'REFERENCE_FIELD',
  dataType: 'DICTIONARY',
  props: {},
  ...overrides,
})

const row = (values: Record<string, unknown> = {}): TableRow => ({
  rowId: 'tmp-1',
  ...values,
})

describe('findAutoAdvanceColumn (SCRUM-363)', () => {
  it('без afterBinding — первая видимая редактируемая пустая колонка в порядке layout', () => {
    const columns = [col('A'), col('B')]
    expect(findAutoAdvanceColumn(columns, row())?.binding).toBe('A')
  })

  it('с afterBinding — продолжает строго после указанной колонки', () => {
    const columns = [col('A'), col('B'), col('C')]
    expect(findAutoAdvanceColumn(columns, row(), 'A')?.binding).toBe('B')
  })

  it('справа ничего не осталось → undefined (конец строки)', () => {
    const columns = [col('A'), col('B')]
    expect(findAutoAdvanceColumn(columns, row(), 'B')).toBeUndefined()
  })

  it('пропускает visible:false', () => {
    const columns = [col('A', { props: { visible: false } }), col('B')]
    expect(findAutoAdvanceColumn(columns, row())?.binding).toBe('B')
  })

  it('пропускает readonly:true колонки', () => {
    const columns = [col('A', { readonly: true }), col('B')]
    expect(findAutoAdvanceColumn(columns, row())?.binding).toBe('B')
  })

  it('учитывает построчный __readonlyCells', () => {
    const columns = [col('A'), col('B')]
    const r = row({ __readonlyCells: ['A'] })
    expect(findAutoAdvanceColumn(columns, r)?.binding).toBe('B')
  })

  it('пропускает уже заполненную ячейку (автоподстановка сервера)', () => {
    const columns = [col('A'), col('FizicheskoeLitso'), col('C')]
    const r = row({ FizicheskoeLitso: { id: 7, presentation: 'Иванов' } })
    expect(findAutoAdvanceColumn(columns, r, 'A')?.binding).toBe('C')
  })

  it('НЕ пропускает enabled:false — фокус должен остаться в ней', () => {
    const columns = [col('A', { props: { enabled: false } }), col('B')]
    expect(findAutoAdvanceColumn(columns, row())?.binding).toBe('A')
  })
})
