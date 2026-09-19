import { describe, expect, it } from 'vitest'

import { formatFooterValue } from './format-footer-value'

describe('formatFooterValue', () => {
  it('разбивает разряды так же, как ячейки колонок', () => {
    expect(formatFooterValue(268610000)).toBe('268 610 000')
    expect(formatFooterValue(33004000)).toBe('33 004 000')
  })

  it('числовую строку с провода форматирует так же', () => {
    expect(formatFooterValue('4300000.50')).toBe('4 300 000,50')
  })

  it('отрицательный итог сохраняет минус', () => {
    expect(formatFooterValue(-551000)).toBe('-551 000')
  })

  it('нечисловой итог (дата, ссылка, пусто) отдаёт как есть', () => {
    expect(formatFooterValue('2026-09-19')).toBe('2026-09-19')
    expect(formatFooterValue({ id: 1, presentation: 'Иванов И.И.' })).toBe(
      'Иванов И.И.'
    )
    expect(formatFooterValue(null)).toBe('')
  })
})
