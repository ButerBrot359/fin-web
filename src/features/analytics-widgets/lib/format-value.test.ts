import { describe, expect, it } from 'vitest'

import { formatNumber, formatValue, toFiniteNumber } from './format-value'

const NBSP = '\u00A0'

describe('toFiniteNumber', () => {
  it('разбирает PostgreSQL numeric из строки', () => {
    expect(toFiniteNumber('1234.56')).toBe(1234.56)
    expect(toFiniteNumber('1234,56')).toBe(1234.56)
    expect(toFiniteNumber(`1${NBSP}234.5`)).toBe(1234.5)
  })

  it('не превращает пустое значение в ноль', () => {
    expect(toFiniteNumber(null)).toBeNull()
    expect(toFiniteNumber(undefined)).toBeNull()
    expect(toFiniteNumber('')).toBeNull()
    expect(toFiniteNumber('не число')).toBeNull()
  })
})

describe('formatNumber', () => {
  it('разделяет разряды неразрывным пробелом', () => {
    expect(formatNumber(1234567.891, 2)).toBe(`1${NBSP}234${NBSP}567,89`)
    expect(formatNumber(999, 0)).toBe('999')
    expect(formatNumber(1000, 0)).toBe(`1${NBSP}000`)
  })

  it('сохраняет знак и не выводит «минус ноль»', () => {
    expect(formatNumber(-1234.5, 2)).toBe(`-1${NBSP}234,50`)
    expect(formatNumber(-0.001, 2)).toBe('0,00')
  })
})

describe('formatValue', () => {
  it('MONEY — два знака и разряды', () => {
    expect(formatValue('1234567.891', 'MONEY')).toBe(`1${NBSP}234${NBSP}567,89`)
    expect(formatValue(0, 'MONEY')).toBe('0,00')
  })

  it('INTEGER — без дробной части', () => {
    expect(formatValue(1234.7, 'INTEGER')).toBe(`1${NBSP}235`)
  })

  it('DECIMAL2 — два знака', () => {
    expect(formatValue(2.5, 'DECIMAL2')).toBe('2,50')
  })

  it('PERCENT — со знаком процента через неразрывный пробел', () => {
    expect(formatValue(12.5, 'PERCENT')).toBe(`12,50${NBSP}%`)
    expect(formatValue(-3, 'PERCENT')).toBe(`-3,00${NBSP}%`)
  })

  it('DATE и DATETIME — детерминированный вид, как в 1С', () => {
    expect(formatValue('2026-03-07', 'DATE')).toBe('07.03.2026')
    expect(formatValue('2026-03-07T14:05:00', 'DATETIME')).toBe(
      '07.03.2026 14:05'
    )
    expect(formatValue('не дата', 'DATE')).toBe('')
  })

  it('PLAIN — строка как есть, булево — глифом', () => {
    expect(formatValue('Касса', 'PLAIN')).toBe('Касса')
    expect(formatValue(true, 'PLAIN')).toBe('✓')
    expect(formatValue(false, 'PLAIN')).toBe('—')
  })

  it('пустое значение — пустая строка', () => {
    expect(formatValue(null, 'MONEY')).toBe('')
    expect(formatValue(undefined, 'PLAIN')).toBe('')
  })
})
