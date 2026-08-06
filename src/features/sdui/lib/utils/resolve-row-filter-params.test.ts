import { describe, it, expect } from 'vitest'
import { resolveRowFilterParams } from './resolve-row-filter-params'
import type { TableColumnDef, TableRow } from '../hooks/use-table-sync'

const col = (overrides: Partial<TableColumnDef>): TableColumnDef => ({
  id: 'table.osnovnyeSredstva.col.vidVNA',
  label: 'Вид ВНА',
  binding: 'VidVNA',
  cellWidget: 'REFERENCE_FIELD',
  dataType: 'DICTIONARY',
  props: {},
  ...overrides,
})

describe('resolveRowFilterParams', () => {
  it('rowFilter + __rowParentIds[binding] → {parent: String(value)}', () => {
    const c = col({ props: { rowFilter: { parent: 'OsnovnoeSredstvo' } } })
    const row: TableRow = { rowId: '1', __rowParentIds: { VidVNA: 4711 } }
    expect(resolveRowFilterParams(c, row)).toEqual({ parent: '4711' })
  })
  it('нет rowFilter → {}', () => {
    const row: TableRow = { rowId: '1', __rowParentIds: { VidVNA: 4711 } }
    expect(resolveRowFilterParams(col({}), row)).toEqual({})
  })
  it('нет ключа в __rowParentIds → {}', () => {
    const c = col({ props: { rowFilter: { parent: 'OsnovnoeSredstvo' } } })
    expect(resolveRowFilterParams(c, { rowId: '1' })).toEqual({})
  })
})
