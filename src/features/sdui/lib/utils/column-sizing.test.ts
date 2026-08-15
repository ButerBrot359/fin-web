import { describe, expect, it } from 'vitest'

import {
  SDUI_MIN_COLUMN_WIDTH,
  toColumnWidth,
  toRelativeColumnId,
} from './column-sizing'

describe('toColumnWidth', () => {
  it('число и Long-строка приводятся к px', () => {
    expect(toColumnWidth(120)).toBe(120)
    expect(toColumnWidth('120')).toBe(120)
    expect(toColumnWidth(120.5)).toBe(120.5)
  })

  it('мусор, ноль и отрицательное отбрасываются', () => {
    expect(toColumnWidth(undefined)).toBeUndefined()
    expect(toColumnWidth(null)).toBeUndefined()
    expect(toColumnWidth('')).toBeUndefined()
    expect(toColumnWidth('широкая')).toBeUndefined()
    expect(toColumnWidth(0)).toBeUndefined()
    expect(toColumnWidth(-10)).toBeUndefined()
    expect(toColumnWidth(Number.POSITIVE_INFINITY)).toBeUndefined()
    expect(toColumnWidth({})).toBeUndefined()
  })
})

describe('toRelativeColumnId', () => {
  it('отрезает префикс узла таблицы', () => {
    expect(toRelativeColumnId('table.tmz', 'table.tmz.col.nomenklatura')).toBe(
      'col.nomenklatura'
    )
  })

  // Главный кейс: у пикера справочника columnStateKey общий на ТИП
  // (panel:DICTIONARY:Kontragenty), а абсолютные id колонок содержат код поля
  // формы. Без отрезания префикса ширины из разных полей попадали бы в одну
  // карту разными ключами и никогда не применялись бы друг к другу.
  it('пикер: колонки из разных полей формы дают ОДИН ключ', () => {
    const fromKontragent = toRelativeColumnId(
      'panel.choice.field.kontragent.list',
      'panel.choice.field.kontragent.list.col.nameRu'
    )
    const fromPlatelshchik = toRelativeColumnId(
      'panel.choice.field.platelshchik.list',
      'panel.choice.field.platelshchik.list.col.nameRu'
    )
    expect(fromKontragent).toBe('col.nameRu')
    expect(fromPlatelshchik).toBe(fromKontragent)
  })

  it('id без префикса остаётся как есть', () => {
    expect(toRelativeColumnId('table.tmz', 'col.summa')).toBe('col.summa')
    // Совпадение по началу без точки-разделителя префиксом не считается
    expect(toRelativeColumnId('table.tmz', 'table.tmzExtra.col.a')).toBe(
      'table.tmzExtra.col.a'
    )
    expect(toRelativeColumnId('table.tmz', 'table.tmz')).toBe('table.tmz')
  })
})

describe('SDUI_MIN_COLUMN_WIDTH', () => {
  it('нижняя граница по умолчанию — 40px (сервер минимум не выдумывает)', () => {
    expect(SDUI_MIN_COLUMN_WIDTH).toBe(40)
  })
})
