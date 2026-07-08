import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../types/view'
import {
  ROW_LAYOUT,
  buildRowDefs,
  collectColumnLabels,
  collectGroupLabels,
  formatSum,
  getBlockRowCount,
  resolveCellValue,
} from './accounting-block-logic'

describe('resolveCellValue', () => {
  it('ссылочная ячейка → presentation', () => {
    expect(
      resolveCellValue({ id: 5, presentation: 'Касса', entityRef: { id: 5 } }),
    ).toBe('Касса')
  })
  it('пусто → пустая строка', () => {
    expect(resolveCellValue('')).toBe('')
    expect(resolveCellValue(null)).toBe('')
    expect(resolveCellValue(undefined)).toBe('')
    expect(resolveCellValue({})).toBe('')
  })
  it('строка как есть (коды счетов и даты не форматируются)', () => {
    expect(resolveCellValue('1080')).toBe('1080')
    expect(resolveCellValue('07.07.2026 10:15:30')).toBe('07.07.2026 10:15:30')
  })
  it('число → разряды пробелами', () => {
    expect(resolveCellValue(12345)).toBe('12 345')
  })
})

describe('formatSum', () => {
  it('"12345.00" → "12 345,00"', () => {
    expect(formatSum('12345.00')).toBe('12 345,00')
  })
  it('"2000.0000" (scale-4 бэка) → "2 000,00"', () => {
    expect(formatSum('2000.0000')).toBe('2 000,00')
  })
  it('пусто → ""', () => {
    expect(formatSum('')).toBe('')
    expect(formatSum(null)).toBe('')
    expect(formatSum(undefined)).toBe('')
  })
})

describe('collectColumnLabels / collectGroupLabels', () => {
  const table = {
    id: 'tbl',
    type: 'TABLE',
    children: [
      { id: 'c.period', type: 'TABLE_COLUMN', binding: '_period', props: { label: 'Дата' } },
      {
        id: 'g.dt',
        type: 'COLUMN_GROUP',
        props: { label: 'ДЕБЕТ' },
        children: [
          { id: 'c.accDt', type: 'TABLE_COLUMN', binding: '_accountDtCode', props: { label: 'Счёт' } },
          { id: 'c.subDt1', type: 'TABLE_COLUMN', binding: '_subkontoDt1', props: { label: 'КПС' } },
        ],
      },
      {
        id: 'g.kt',
        type: 'COLUMN_GROUP',
        props: { label: 'КРЕДИТ' },
        children: [
          { id: 'c.accKt', type: 'TABLE_COLUMN', binding: '_accountKtCode', props: { label: 'Счёт' } },
        ],
      },
    ],
  } as ViewNode

  it('собирает binding → label по листьям, включая вложенные в группы', () => {
    const labels = collectColumnLabels(table)
    expect(labels.get('_period')).toBe('Дата')
    expect(labels.get('_subkontoDt1')).toBe('КПС')
    expect(labels.get('_accountKtCode')).toBe('Счёт')
  })

  it('метки групп верхнего уровня в порядке документа', () => {
    expect(collectGroupLabels(table)).toEqual(['ДЕБЕТ', 'КРЕДИТ'])
  })
})

describe('getBlockRowCount / buildRowDefs', () => {
  it('минимум 3 строки', () => {
    expect(getBlockRowCount([])).toBe(3)
    expect(getBlockRowCount([{ rowId: '1', _subkontoDt1: '' }])).toBe(3)
  })
  it('расширяется по фактическому max индексу субконто', () => {
    expect(getBlockRowCount([{ rowId: '1', _subkontoKt4: '' }])).toBe(4)
  })
  it('строки 1-3 из ROW_LAYOUT, дальше — только субконто', () => {
    const defs = buildRowDefs(4)
    expect(defs.slice(0, 3)).toEqual(ROW_LAYOUT)
    expect(defs[3]).toEqual({
      subDt: '_subkontoDt4',
      subKt: '_subkontoKt4',
      a1Dt: '',
      a1Kt: '',
      a2Dt: '',
      a2Kt: '',
    })
  })
})
