import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type {
  ReportColumnDto,
  ReportResultDto,
} from '@/pages/reports/report-list/types/report'

import { LedgerTable } from './ledger-table'

afterEach(cleanup)

const resultOf = (columns: ReportColumnDto[]): ReportResultDto =>
  ({
    reportCode: 'ZhurnalVydannykhDoverennostey',
    reportNameRu: 'Журнал учёта выданных доверенностей',
    columns,
    rows: [
      {
        level: 0,
        rowKind: 'DATA',
        cells: { Nomer: '000001', Postavshchik: 'ТОО Ромашка' },
        children: [],
      },
    ],
    total: {},
    layout: 'LEDGER',
  }) as unknown as ReportResultDto

describe('LedgerTable — строка номеров граф', () => {
  it('рисует номера граф отдельной строкой под шапкой, как в макете 1С', () => {
    const columns: ReportColumnDto[] = [
      {
        code: 'Nomer',
        titleRu: '№ доверенности',
        role: 'ATTRIBUTE',
        valueType: 'STRING',
        columnNumber: '1',
      },
      {
        code: 'Postavshchik',
        titleRu: 'Поставщик',
        role: 'ATTRIBUTE',
        valueType: 'STRING',
        columnNumber: '5',
      },
    ]

    render(<LedgerTable result={resultOf(columns)} columns={columns} />)

    const numbersRow = screen.getByTestId('report-column-numbers')
    expect(
      Array.from(numbersRow.querySelectorAll('th')).map((th) => th.textContent)
    ).toEqual(['1', '5'])
    expect(numbersRow.parentElement?.lastElementChild).toBe(numbersRow)
  })

  it('без номеров у колонок лишней строки в шапке нет', () => {
    const columns: ReportColumnDto[] = [
      { code: 'Nomer', titleRu: '№', role: 'ATTRIBUTE', valueType: 'STRING' },
    ]

    render(<LedgerTable result={resultOf(columns)} columns={columns} />)

    expect(screen.queryByTestId('report-column-numbers')).toBeNull()
  })
})
