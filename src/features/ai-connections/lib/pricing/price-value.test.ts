import { describe, expect, it } from 'vitest'
import { parsePriceValue, priceValueText } from './price-value'

describe('connection pricing values', () => {
  it('preserves unknown rates and explicit zero independently', () => {
    expect(parsePriceValue('')).toBeNull()
    expect(parsePriceValue('  ')).toBeNull()
    expect(parsePriceValue('0')).toBe(0)
    expect(priceValueText(null)).toBe('')
    expect(priceValueText(0)).toBe('0')
  })
  it('accepts decimal comma without truncating or rounding rates', () => {
    expect(parsePriceValue(' 0,000125 ')).toBe(0.000125)
    expect(parsePriceValue('3.75')).toBe(3.75)
    expect(parsePriceValue('.5')).toBe(0.5)
  })
  it('rejects negative, nonfinite and malformed rates', () => {
    for (const raw of ['-1', '-0.1', 'NaN', 'Infinity', '2.3.4', '2x', '1e309'])
      expect(parsePriceValue(raw)).toBeUndefined()
  })
})
