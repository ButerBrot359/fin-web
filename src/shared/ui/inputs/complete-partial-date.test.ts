import { describe, expect, it } from 'vitest'

import {
  completePartialDate,
  type PartialDateSection,
} from './complete-partial-date'

const TODAY = new Date(2026, 8, 28, 15, 40)

const digit = (type: string, value: string): PartialDateSection => ({
  type,
  value,
  contentType: 'digit',
})

const dmy = (d: string, m: string, y: string) => [
  digit('day', d),
  digit('month', m),
  digit('year', y),
]

const ymd = (date: Date | null) =>
  date && [date.getFullYear(), date.getMonth() + 1, date.getDate()]

describe('completePartialDate — достроение даты как в 1С', () => {
  it('«28» — текущие месяц и год', () => {
    expect(ymd(completePartialDate(dmy('28', '', ''), TODAY))).toEqual([2026, 9, 28])
  })

  it('«28.09» — текущий год', () => {
    expect(ymd(completePartialDate(dmy('28', '09', ''), TODAY))).toEqual([2026, 9, 28])
  })

  it('«15.03» — день и месяц набранные, год текущий', () => {
    expect(ymd(completePartialDate(dmy('15', '03', ''), TODAY))).toEqual([2026, 3, 15])
  })

  it('пустое поле не достраивается', () => {
    expect(completePartialDate(dmy('', '', ''), TODAY)).toBeNull()
  })

  it('полностью набранная дата — забота пикера, не наша', () => {
    expect(completePartialDate(dmy('28', '09', '2026'), TODAY)).toBeNull()
  })

  it('дыра в середине («28.__.2026») не угадывается', () => {
    expect(completePartialDate(dmy('28', '', '2026'), TODAY)).toBeNull()
  })

  it('без дня («__.09») не угадывается', () => {
    expect(completePartialDate(dmy('', '09', ''), TODAY)).toBeNull()
  })

  it('несуществующее число месяца не превращается в соседнее', () => {
    expect(completePartialDate(dmy('31', '02', ''), TODAY)).toBeNull()
  })

  it('поле со временем: время обнуляется, дата достраивается', () => {
    const result = completePartialDate(
      [...dmy('28', '', ''), digit('hours', ''), digit('minutes', '')],
      TODAY
    )
    expect(ymd(result)).toEqual([2026, 9, 28])
    expect([result?.getHours(), result?.getMinutes()]).toEqual([0, 0])
  })

  it('поле со временем: набранная дата без времени получает 00:00', () => {
    const result = completePartialDate(
      [...dmy('28', '09', '2026'), digit('hours', ''), digit('minutes', '')],
      TODAY
    )
    expect(ymd(result)).toEqual([2026, 9, 28])
    expect(result?.getHours()).toBe(0)
  })

  it('маска «MM.yyyy»: набран месяц — год текущий, день первое число', () => {
    const result = completePartialDate(
      [digit('month', '05'), digit('year', '')],
      TODAY
    )
    expect(ymd(result)).toEqual([2026, 5, 1])
  })

  it('месяц названием (маска «LLLL yyyy») не достраивается', () => {
    const result = completePartialDate(
      [{ type: 'month', value: 'май', contentType: 'letter' }, digit('year', '')],
      TODAY
    )
    expect(result).toBeNull()
  })
})
