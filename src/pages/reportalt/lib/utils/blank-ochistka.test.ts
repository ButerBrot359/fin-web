import { describe, expect, it } from 'vitest'

import type { ReportSpreadsheetDto } from '@/pages/reports/report-list/types/report'

import { pustyeOblastiStranits, stranitsaPrilozheniya } from './blank-ochistka'

const list = (title: string, polya: string[]) => ({
  code: title,
  title,
  columnWidths: [10],
  rowHeights: [10],
  cells: polya.map((field, i) => ({ row: i, column: 0, text: '1', field })),
})

const blank: ReportSpreadsheetDto = {
  sheets: [
    list('Страница 1', ['s_200_00_001_1']),
    list('200.05 стр.1', ['Ф20005A101_1', 'Ф20005A102_1']),
    list('200.05 стр.2', ['Ф20005A201_1']),
  ],
}

describe('Очистка страниц бланка', () => {
  it('очищаются области только выбранной страницы', () => {
    expect(pustyeOblastiStranits(blank, (_, indeks) => indeks === 0)).toEqual({
      s_200_00_001_1: '',
    })
  })

  it('очистка приложения 200.05 берёт все его страницы', () => {
    expect(
      pustyeOblastiStranits(blank, (title) =>
        stranitsaPrilozheniya(title, '200.05')
      )
    ).toEqual({
      Ф20005A101_1: '',
      Ф20005A102_1: '',
      Ф20005A201_1: '',
    })
  })

  it('без бланка очищать нечего', () => {
    expect(pustyeOblastiStranits(undefined, () => true)).toEqual({})
  })

  it('страница основной формы не считается страницей приложения', () => {
    expect(stranitsaPrilozheniya('Страница 1', '200.05')).toBe(false)
    expect(stranitsaPrilozheniya('200.05 стр.1', '200.05')).toBe(true)
  })
})
