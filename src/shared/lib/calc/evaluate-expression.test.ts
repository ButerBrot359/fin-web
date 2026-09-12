import { describe, expect, it } from 'vitest'

import { evaluateExpression, roundTo } from './evaluate-expression'
import { formatCalcNumber } from './format-calc-number'

const value = (expression: string) => evaluateExpression(expression).value
const error = (expression: string) => evaluateExpression(expression).error

describe('evaluateExpression — арифметика', () => {
  it('считает приоритет операций и скобки', () => {
    expect(value('1200*12+300')).toBe(14700)
    expect(value('(1000+200)/3')).toBe(400)
    expect(value('2+2*2')).toBe(6)
  })

  it('принимает запятую и разрядные пробелы, как их пишет бухгалтер', () => {
    expect(value('34 600,50+1 000')).toBe(35600.5)
    expect(value('1 000,25*2')).toBe(2000.5)
  })

  it('понимает знаки из клавиатуры и из 1С: x, ×, :, ÷', () => {
    expect(value('12x3')).toBe(36)
    expect(value('12×3')).toBe(36)
    expect(value('12:3')).toBe(4)
    expect(value('12÷3')).toBe(4)
  })

  it('обрабатывает унарный минус', () => {
    expect(value('-500+100')).toBe(-400)
    expect(value('100*-2')).toBe(-200)
  })

  it('пустая строка — это не ошибка, а «ещё ничего не введено»', () => {
    expect(evaluateExpression('   ')).toEqual({ value: null })
  })
})

describe('evaluateExpression — проценты по-бухгалтерски', () => {
  // «Сумма + 12%» бухгалтер читает как наценку на эту же сумму, а не как «+0,12».
  it('в сложении и вычитании процент берётся от левой части', () => {
    expect(value('84000+12%')).toBe(94080)
    expect(value('84000-12%')).toBe(73920)
  })

  it('в умножении и делении процент — обычная доля', () => {
    expect(value('84000*12%')).toBe(10080)
    expect(value('11200/112%')).toBeCloseTo(10000, 6)
  })

  it('процент сам по себе — доля единицы', () => {
    expect(value('12%')).toBeCloseTo(0.12, 10)
  })
})

describe('evaluateExpression — ошибки', () => {
  it('сообщает о делении на ноль отдельно от синтаксиса', () => {
    expect(error('100/0')).toBe('divZero')
  })

  it('ловит незакрытую скобку и висящую операцию', () => {
    expect(error('(100+200')).toBe('syntax')
    expect(error('100+')).toBe('syntax')
    expect(error('100 200 +')).toBe('syntax')
  })
})

describe('roundTo / formatCalcNumber', () => {
  it('округляет половину от нуля, как 1С', () => {
    expect(roundTo(2.345, 2)).toBe(2.35)
    expect(roundTo(-2.5, 0)).toBe(-3)
    expect(roundTo(1.005, 2)).toBe(1.01)
  })

  it('показывает число разрядами и запятой', () => {
    expect(formatCalcNumber(34600.5, 2)).toBe('34 600,50')
    expect(formatCalcNumber(34600.5, 2, false)).toBe('34 600,5')
    expect(formatCalcNumber(1234567, 0)).toBe('1 234 567')
    expect(formatCalcNumber(-0.004, 2)).toBe('0,00')
  })
})
