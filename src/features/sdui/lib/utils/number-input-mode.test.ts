import { describe, it, expect } from 'vitest'

import { allowsDecimalInput } from './number-input-mode'

describe('allowsDecimalInput', () => {
  it('precision с бэка авторитетен: 0 — только целое, больше нуля — дробное', () => {
    expect(allowsDecimalInput({ precision: 0 })).toBe(false)
    expect(allowsDecimalInput({ precision: 2 })).toBe(true)
    // «Ставка» и «Размер оклада» в эталоне 1С — три знака (1,500 / 85 123,000).
    expect(allowsDecimalInput({ precision: 3 })).toBe(true)
  })

  it('precision перебивает dataType', () => {
    expect(allowsDecimalInput({ precision: 2 }, 'INTEGER')).toBe(true)
    expect(allowsDecimalInput({ precision: 0 }, 'DECIMAL')).toBe(false)
  })

  it('без precision решает dataType: INTEGER — целое, DECIMAL — дробное', () => {
    expect(allowsDecimalInput({}, 'INTEGER')).toBe(false)
    expect(allowsDecimalInput({}, 'DECIMAL')).toBe(true)
  })

  // Ключевое умолчание: неразмеченное поле НЕ становится целочисленным. Именно
  // прежнее «нет precision → 0» и глотало запятую в «Тарифном коэффициенте».
  it('ничего не известно — дробная часть разрешена', () => {
    expect(allowsDecimalInput(undefined)).toBe(true)
    expect(allowsDecimalInput({})).toBe(true)
    expect(allowsDecimalInput({}, 'NUMBER')).toBe(true)
  })

  it('мусор вместо числа не считается указанием точности', () => {
    expect(allowsDecimalInput({ precision: '0' })).toBe(true)
  })
})
