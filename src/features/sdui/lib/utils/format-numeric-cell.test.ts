import { describe, expect, it } from 'vitest'

import { formatNumericCell } from './format-numeric-cell'

describe('formatNumericCell', () => {
  it('числовая колонка получает разделение разрядов', () => {
    expect(formatNumericCell(268610000, 'DECIMAL')).toBe('268 610 000')
    expect(formatNumericCell('268610000', 'DECIMAL')).toBe('268 610 000')
    expect(formatNumericCell(4300, 'INTEGER')).toBe('4 300')
    expect(formatNumericCell('-551000.50', 'DECIMAL')).toBe('-551 000,50')
  })

  it('цифровые СТРОКИ нечисловых колонок остаются как есть', () => {
    expect(formatNumericCell('160440007161', 'STRING')).toBe('160440007161')
    expect(formatNumericCell('KZ12009NPS0413609816', 'STRING')).toBe(
      'KZ12009NPS0413609816'
    )
    expect(formatNumericCell('AAY00-00011', 'STRING')).toBe('AAY00-00011')
  })

  it('дата и ссылка идут прежним путём', () => {
    expect(formatNumericCell('17.09.2026 16:35', 'DATETIME')).toBe(
      '17.09.2026 16:35'
    )
    expect(
      formatNumericCell(
        { id: 1, presentation: 'ГУ Аппарат акима' },
        'DICTIONARY'
      )
    ).toBe('ГУ Аппарат акима')
  })

  it('без dataType числом считается само значение (подвал ТЧ)', () => {
    expect(formatNumericCell(268610000)).toBe('268 610 000')
    expect(formatNumericCell('не число')).toBe('не число')
    expect(formatNumericCell(null)).toBe('')
  })
})
