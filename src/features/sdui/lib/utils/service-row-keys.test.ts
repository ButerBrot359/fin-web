import { describe, it, expect } from 'vitest'
import { omitServiceRowKeys } from './service-row-keys'
import type { TableRow } from '../hooks/use-table-sync'

describe('omitServiceRowKeys', () => {
  it('вырезает служебные ключи, значения и rowId оставляет', () => {
    const row: TableRow = {
      rowId: '12345',
      IstochnikFinansirovaniya: { id: 501, presentation: 'Деньги…' },
      KodPlatnykhUslug: null,
      Summa: 0,
      __requiredCells: ['KodPlatnykhUslug'],
      __readonlyCells: ['Razmer'],
      __rowReadonly: true,
    }
    expect(omitServiceRowKeys(row)).toEqual({
      rowId: '12345',
      IstochnikFinansirovaniya: { id: 501, presentation: 'Деньги…' },
      KodPlatnykhUslug: null,
      Summa: 0,
    })
  })

  it('вырезает и ключи прежних задач — правило по префиксу, не по списку', () => {
    const row: TableRow = {
      rowId: '1',
      VidVNA: null,
      __rowParentIds: { VidVNA: 4711 },
      __subkontoAllowedTypes: ['Kontragenty'],
    }
    expect(omitServiceRowKeys(row)).toEqual({ rowId: '1', VidVNA: null })
  })

  it('строка без служебных ключей не меняется по содержимому', () => {
    const row: TableRow = { rowId: '1', a: 1, b: 'x' }
    expect(omitServiceRowKeys(row)).toEqual(row)
  })
})
