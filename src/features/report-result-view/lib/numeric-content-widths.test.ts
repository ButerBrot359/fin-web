import { describe, expect, it } from 'vitest'

import type {
  ReportColumnDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import { numericContentWidths } from './numeric-content-widths'

const col = (
  code: string,
  extra: Partial<ReportColumnDto> = {}
): ReportColumnDto => ({
  code,
  titleRu: code,
  role: 'MEASURE',
  valueType: 'DECIMAL',
  ...extra,
})

const row = (
  cells: Record<string, unknown>,
  rowKind: ReportRowDto['rowKind'] = 'DATA'
): ReportRowDto =>
  ({ level: 0, rowKind, cells, children: [] }) as unknown as ReportRowDto

describe('numericContentWidths', () => {
  it('у текстовой колонки минимума по содержимому нет', () => {
    const columns = [col('Fio', { role: 'ATTRIBUTE', valueType: 'STRING' })]
    expect(
      numericContentWidths(columns, [row({ Fio: 'Алдамжаров Б.' })])
    ).toEqual([0])
  })

  it('берёт самое длинное значение колонки в формате 1С', () => {
    const columns = [col('Oklad')]
    expect(
      numericContentWidths(columns, [
        row({ Oklad: 195000 }),
        row({ Oklad: 471250.5 }),
      ])
    ).toEqual([Math.ceil('471 250,50'.length * 6.5) + 14])
  })

  it('строку «Итого» меряет жирным шрифтом выделенной строки', () => {
    const columns = [col('Oklad')]
    expect(
      numericContentWidths(columns, [
        row({ Oklad: 471250.5 }),
        row({ Oklad: 3538000 }, 'TOTAL'),
      ])
    ).toEqual(['3 538 000,00'.length * 8 + 14])
  })

  it('пропускает пустые и скрытые нули', () => {
    const columns = [col('Nadbavka', { blankOnZero: true })]
    expect(
      numericContentWidths(columns, [row({ Nadbavka: 0 }), row({})])
    ).toEqual([0])
  })
})
