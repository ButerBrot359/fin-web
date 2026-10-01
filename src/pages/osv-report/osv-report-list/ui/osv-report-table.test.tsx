import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { OsvReportEntry } from '../types/osv-report'
import { OsvReportTable, type OsvClickZone } from './osv-report-table'

vi.mock('@/shared/assets/icons/arrow-down.svg', () => ({ default: () => null }))

const rows: OsvReportEntry[] = [
  {
    accountId: 99,
    accountCode: '3241',
    accountNameRu: 'Краткосрочная кредиторская задолженность',
    turnoverKt: 476435,
  },
]

afterEach(cleanup)

describe('OsvReportTable — зона двойного клика', () => {
  it('наименование строки — label, сумма — value', () => {
    const zones: OsvClickZone[] = []
    render(
      <OsvReportTable
        rows={rows}
        showQuantity={false}
        onRowDoubleClick={(_row, _event, zone) => zones.push(zone)}
      />
    )

    fireEvent.doubleClick(
      screen.getByText('Краткосрочная кредиторская задолженность')
    )
    fireEvent.doubleClick(screen.getByText(/476/))

    expect(zones).toEqual(['label', 'value'])
  })
})
