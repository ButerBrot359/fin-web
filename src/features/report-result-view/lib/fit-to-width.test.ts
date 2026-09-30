import { describe, expect, it } from 'vitest'

import type {
  ReportColumnDto,
  ReportFormSectionDto,
} from '@/pages/reports/report-list/types/report'

import { fitToWidthLayout } from './fit-to-width'

const cols = [
  { code: 'F405Opisanie', width: 35, wrap: true },
  { code: 'F405Debet', width: 24, wrap: true },
  { code: 'F405Kredit', width: 15, wrap: true },
  { code: 'F405Summa', width: 14, role: 'MEASURE' },
] as ReportColumnDto[]

const section = (summa: number): ReportFormSectionDto =>
  ({
    columns: cols,
    rows: [{ level: 0, cells: { F405Summa: summa } }],
  }) as never

describe('fitToWidthLayout', () => {
  it('ширины граф — доли от суммы ширин с бэкенда', () => {
    const layout = fitToWidthLayout(cols, section(526000), 8)

    expect(layout?.widths.map((w) => Number.parseFloat(w).toFixed(2))).toEqual([
      '39.77',
      '27.27',
      '17.05',
      '15.91',
    ])
  })

  it('минимальная ширина — наименьшая, при которой ни одна графа не уже своего минимума', () => {
    expect(fitToWidthLayout(cols, section(526000), 8)?.minWidth).toBe(611)
  })

  it('крупная сумма поднимает минимальную ширину, чтобы число не обрезалось', () => {
    expect(fitToWidthLayout(cols, section(123456789), 8)?.minWidth).toBe(704)
  })

  it('без ширин с бэкенда пропорций нет', () => {
    expect(
      fitToWidthLayout([{ code: 'A' }] as ReportColumnDto[], section(0), 8)
    ).toBeNull()
  })
})
