import { describe, expect, it } from 'vitest'

import type {
  ReportColumnDto,
  ReportRowDto,
} from '@/pages/reports/report-list/types/report'

import { columnContentWidths, headWordWidths } from './column-content-widths'

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

const titleRu = (c: ReportColumnDto) => c.titleRu

describe('headWordWidths', () => {
  it('держит самое длинное слово заголовка целиком', () => {
    const columns = [col('Posobie', { titleRu: 'Пособие на оздоровление' })]
    expect(headWordWidths(columns, titleRu)).toEqual([
      Math.ceil('оздоровление'.length * 9.5) + 14,
    ])
  })

  it('вертикальному заголовку ширина по словам не нужна', () => {
    const columns = [
      col('Posobie', { titleRu: 'оздоровление', verticalTitle: true }),
    ]
    expect(headWordWidths(columns, titleRu)).toEqual([0])
  })
})

describe('columnContentWidths', () => {
  it('берёт самую длинную сумму колонки в формате 1С', () => {
    const columns = [col('Oklad')]
    expect(
      columnContentWidths(
        columns,
        [row({ Oklad: 195000 }), row({ Oklad: 471250.5 })],
        [0]
      )
    ).toEqual([Math.ceil('471 250,50'.length * 6.5) + 14])
  })

  it('строку «Итого» меряет жирным шрифтом выделенной строки', () => {
    const columns = [col('Oklad')]
    expect(
      columnContentWidths(
        columns,
        [row({ Oklad: 471250.5 }), row({ Oklad: 3538000 }, 'TOTAL')],
        [0]
      )
    ).toEqual([Math.ceil('3 538 000,00'.length * 8.5) + 14])
  })

  it('текстовую колонку меряет по значению, но не шире предела', () => {
    const columns = [
      col('Fio', { role: 'DIMENSION', valueType: 'STRING' }),
      col('Dolzhnost', { role: 'DIMENSION', valueType: 'STRING' }),
    ]
    expect(
      columnContentWidths(
        columns,
        [row({ Fio: 'Алдамжаров Б.', Dolzhnost: 'Я'.repeat(80) })],
        [0, 0]
      )
    ).toEqual([
      Math.ceil('Алдамжаров Б.'.length * 7.5) + 14,
      Math.ceil(30 * 7.5) + 14,
    ])
  })

  it('итог-строку с неразрывными пробелами меряет целиком жирным шрифтом', () => {
    const columns = [
      col('Nadbavka', {
        role: 'ATTRIBUTE',
        valueType: 'STRING',
        align: 'RIGHT',
        verticalTitle: true,
      }),
    ]
    expect(
      columnContentWidths(
        columns,
        [
          row({ Nadbavka: '10\u00a0618' }),
          row({ Nadbavka: '3\u00a0260\u00a0227' }, 'TOTAL'),
        ],
        [0]
      )
    ).toEqual([Math.ceil('3 260 227'.length * 9.5) + 14])
  })

  it('не бывает уже заголовка, даже если значения пустые', () => {
    const columns = [col('Nadbavka', { blankOnZero: true })]
    expect(
      columnContentWidths(columns, [row({ Nadbavka: 0 }), row({})], [94])
    ).toEqual([94])
  })
})
