import { render, screen, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import type { ReportColumnDto } from '@/pages/reports/report-list/types/report'

import { ReportCell } from './report-cell'

const column = (over: Partial<ReportColumnDto>): ReportColumnDto => ({
  code: 'Col',
  titleRu: 'Колонка',
  role: 'ATTRIBUTE',
  valueType: 'STRING',
  ...over,
})

afterEach(cleanup)

describe('ReportCell — формат по объявленному типу значения', () => {
  it('число в ATTRIBUTE-колонке с valueType DECIMAL печатается денежным форматом', () => {
    render(
      <ReportCell value={218247500} col={column({ valueType: 'DECIMAL' })} />
    )

    expect(screen.getByText('218 247 500,00')).toBeTruthy()
  })

  it('ISO-дата в DIMENSION-колонке с valueType DATE печатается как dd.MM.yyyy', () => {
    render(
      <ReportCell
        value="2026-09-01T00:00:00"
        col={column({ role: 'DIMENSION', valueType: 'DATE' })}
      />
    )

    expect(screen.getByText('01.09.2026')).toBeTruthy()
  })

  it('valueType DATETIME форматируется так же, как DATE', () => {
    render(
      <ReportCell
        value="2026-09-01T00:00:00"
        col={column({ valueType: 'DATETIME' })}
      />
    )

    expect(screen.getByText('01.09.2026')).toBeTruthy()
  })

  it('роль MEASURE по-прежнему форматируется без объявленного valueType', () => {
    render(<ReportCell value={150.5} col={column({ role: 'MEASURE' })} />)

    expect(screen.getByText('150,50')).toBeTruthy()
  })

  it('строковая колонка не трогается: текст остаётся как есть', () => {
    render(<ReportCell value="1315" col={column({})} />)

    expect(screen.getByText('1315')).toBeTruthy()
  })
})
