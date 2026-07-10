import { describe, expect, it } from 'vitest'

import type { DocumentAttribute } from '@/entities/document-type'

import { resolveSumRecalc, computeRowSum } from './row-sum-recalc'

const col = (code: string, code1C: string): DocumentAttribute =>
  ({ code, code1C, dataType: 'DECIMAL' }) as DocumentAttribute

describe('resolveSumRecalc', () => {
  it('находит колонки по 1С-именам', () => {
    const cols = [
      col('Nomenklatura', 'Номенклатура'),
      col('UslugiKolichestvo', 'Количество'),
      col('UslugiTsena', 'Цена'),
      col('UslugiSumma', 'Сумма'),
    ]
    expect(resolveSumRecalc(cols)).toEqual({
      qty: 'UslugiKolichestvo',
      price: 'UslugiTsena',
      sum: 'UslugiSumma',
    })
  })

  it('находит колонки по суффиксу кода (фолбэк)', () => {
    const cols = [
      col('Kolichestvo', ''),
      col('Tsena', ''),
      col('Suma', ''),
    ]
    expect(resolveSumRecalc(cols)).toEqual({
      qty: 'Kolichestvo',
      price: 'Tsena',
      sum: 'Suma',
    })
  })

  it('возвращает null, если нет одной из трёх колонок', () => {
    const cols = [col('UslugiKolichestvo', 'Количество'), col('UslugiTsena', 'Цена')]
    expect(resolveSumRecalc(cols)).toBeNull()
  })
})

describe('computeRowSum', () => {
  it('Количество=3, Цена=222222 → 666666', () => {
    expect(computeRowSum('3', '222222')).toBe(666666)
  })

  it('округляет до копеек', () => {
    expect(computeRowSum('3', '222.225')).toBe(666.68)
  })

  it('пустые/нечисловые → 0', () => {
    expect(computeRowSum('', '100')).toBe(0)
    expect(computeRowSum(null, undefined)).toBe(0)
  })
})
