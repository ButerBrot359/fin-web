import { describe, expect, it } from 'vitest'
import type { Table } from '@tanstack/react-table'

import {
  extractTableExport,
  filterExportRowsById,
} from './extract-table-export'

interface Row {
  id: number
  number: string
  organization: string
}

const column = (
  id: string,
  header: string,
  accessor: (row: Row) => string
) => ({
  column: {
    id,
    accessorFn: accessor,
    columnDef: { header },
  },
  isPlaceholder: false,
  getContext: () => ({}),
})

const tableWithColumns = (headers: ReturnType<typeof column>[]) =>
  ({
    getHeaderGroups: () => [{ headers }],
  }) as unknown as Table<Row>

describe('extractTableExport', () => {
  it('keeps current list order while exporting explicitly selected rows', () => {
    const rows = [
      { id: 1, number: '0001', organization: 'First' },
      { id: 2, number: '0002', organization: 'Second' },
      { id: 3, number: '0003', organization: 'Third' },
    ]

    expect(filterExportRowsById(rows, [3, 1])).toEqual([rows[0], rows[2]])
  })

  it('exports only the column ids selected in the list-output dialog', async () => {
    const table = tableWithColumns([
      column('number', 'Number', (row) => row.number),
      column('organization', 'Organization', (row) => row.organization),
    ])

    await expect(
      extractTableExport(
        table,
        [{ id: 1, number: '0001', organization: 'Qazyna' }],
        { columnIds: ['organization'] }
      )
    ).resolves.toEqual({
      headers: ['Organization'],
      rows: [['Qazyna']],
    })
  })
})
