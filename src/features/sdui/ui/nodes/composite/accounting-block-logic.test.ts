import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../types/view'
import {
  buildBlockModel,
  collectColumnLabels,
  collectGroupLabels,
  formatSum,
  resolveCellValue,
} from './accounting-block-logic'

const col = (binding: string, role?: string): ViewNode =>
  ({
    id: `c.${binding}`,
    type: 'TABLE_COLUMN',
    binding,
    props: role ? { role } : {},
  }) as ViewNode

const group = (label: string, children: ViewNode[]): ViewNode =>
  ({
    id: `g.${label}`,
    type: 'COLUMN_GROUP',
    props: { label },
    children,
  }) as ViewNode

const tableOf = (children: ViewNode[]): ViewNode =>
  ({ id: 'tbl', type: 'TABLE', children }) as ViewNode

describe('resolveCellValue', () => {
  it('ссылочная ячейка → presentation', () => {
    expect(
      resolveCellValue({ id: 5, presentation: 'Касса', entityRef: { id: 5 } })
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
      {
        id: 'c.period',
        type: 'TABLE_COLUMN',
        binding: '_period',
        props: { label: 'Дата' },
      },
      {
        id: 'g.dt',
        type: 'COLUMN_GROUP',
        props: { label: 'ДЕБЕТ' },
        children: [
          {
            id: 'c.accDt',
            type: 'TABLE_COLUMN',
            binding: '_accountDtCode',
            props: { label: 'Счёт' },
          },
          {
            id: 'c.subDt1',
            type: 'TABLE_COLUMN',
            binding: '_subkontoDt1',
            props: { label: 'КПС' },
          },
        ],
      },
      {
        id: 'g.kt',
        type: 'COLUMN_GROUP',
        props: { label: 'КРЕДИТ' },
        children: [
          {
            id: 'c.accKt',
            type: 'TABLE_COLUMN',
            binding: '_accountKtCode',
            props: { label: 'Счёт' },
          },
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

// SCRUM-362 B-3: сетка блока — из ролей-координат props.role, не из ROW_LAYOUT.
describe('buildBlockModel', () => {
  it('полная карта ролей wave-1 → rowDefs строк 1-3 и semantic', () => {
    const table = tableOf([
      col('_period', 'period'),
      group('ДЕБЕТ', [
        col('_accountDtCode', 'accountDt'),
        col('_subkontoDt1', 'blockDt:1:0'),
        col('_fkrDt', 'blockDt:1:1'),
        col('_podrazdelenieDt', 'blockDt:1:2'),
        col('_subkontoDt2', 'blockDt:2:0'),
        col('_spetsifikaDt', 'blockDt:2:1'),
        col('_subkontoDt3', 'blockDt:3:0'),
        col('_istochnikFinansirovaniyaDt', 'blockDt:3:1'),
        col('_kodPlatnykhUslugDt', 'blockDt:3:2'),
      ]),
      group('КРЕДИТ', [
        col('_accountKtCode', 'accountKt'),
        col('_subkontoKt1', 'blockKt:1:0'),
        col('_fkrKt', 'blockKt:1:1'),
        col('_podrazdelenieKt', 'blockKt:1:2'),
        col('_subkontoKt2', 'blockKt:2:0'),
        col('_spetsifikaKt', 'blockKt:2:1'),
        col('_subkontoKt3', 'blockKt:3:0'),
        col('_istochnikFinansirovaniyaKt', 'blockKt:3:1'),
        col('_kodPlatnykhUslugKt', 'blockKt:3:2'),
      ]),
      col('_kolichestvo', 'block:2:2'),
      col('_organizatsiya', 'organization'),
      col('_summa', 'sum'),
      col('_valyutnayaSumma', 'currencySum'),
      col('_soderzhanie', 'content'),
      col('_isActiveLabel', 'active'),
    ])

    const { rowDefs, semantic } = buildBlockModel(table)

    expect(rowDefs).toEqual([
      {
        subDt: '_subkontoDt1',
        subKt: '_subkontoKt1',
        a1Dt: '_fkrDt',
        a1Kt: '_fkrKt',
        a2Dt: '_podrazdelenieDt',
        a2Kt: '_podrazdelenieKt',
      },
      {
        subDt: '_subkontoDt2',
        subKt: '_subkontoKt2',
        a1Dt: '_spetsifikaDt',
        a1Kt: '_spetsifikaKt',
        a2Dt: '_kolichestvo',
        a2Kt: '_kolichestvo',
      },
      {
        subDt: '_subkontoDt3',
        subKt: '_subkontoKt3',
        a1Dt: '_istochnikFinansirovaniyaDt',
        a1Kt: '_istochnikFinansirovaniyaKt',
        a2Dt: '_kodPlatnykhUslugDt',
        a2Kt: '_kodPlatnykhUslugKt',
      },
    ])
    expect(semantic).toEqual({
      period: '_period',
      accountDt: '_accountDtCode',
      accountKt: '_accountKtCode',
      organization: '_organizatsiya',
      sum: '_summa',
      currencySum: '_valyutnayaSumma',
      content: '_soderzhanie',
      active: '_isActiveLabel',
    })
  })

  it('block:<r>:<s> без стороны — одна колонка на обеих сторонах (a2Dt === a2Kt)', () => {
    const table = tableOf([
      col('_subkontoDt2', 'blockDt:2:0'),
      col('_kolichestvo', 'block:2:2'),
    ])
    const { rowDefs } = buildBlockModel(table)
    expect(rowDefs).toHaveLength(2)
    expect(rowDefs[1].a2Dt).toBe('_kolichestvo')
    expect(rowDefs[1].a2Kt).toBe('_kolichestvo')
    expect(rowDefs[1].a2Dt).toBe(rowDefs[1].a2Kt)
  })

  it('субконто строк 4+ без слотов 1/2 → пустые клетки, rowCount по максимуму строки', () => {
    const table = tableOf([
      col('_subkontoDt1', 'blockDt:1:0'),
      col('_subkontoKt1', 'blockKt:1:0'),
      col('_subkontoDt5', 'blockDt:5:0'),
    ])
    const { rowDefs } = buildBlockModel(table)
    expect(rowDefs).toHaveLength(5)
    // строка 5: только субконто Дт, остальные клетки пустые
    expect(rowDefs[4]).toEqual({
      subDt: '_subkontoDt5',
      subKt: '',
      a1Dt: '',
      a1Kt: '',
      a2Dt: '',
      a2Kt: '',
    })
    // промежуточные строки без колонок — полностью пустые
    expect(rowDefs[2]).toEqual({
      subDt: '',
      subKt: '',
      a1Dt: '',
      a1Kt: '',
      a2Dt: '',
      a2Kt: '',
    })
  })

  it('колонки без роли игнорируются (ни в rowDefs, ни в semantic)', () => {
    const table = tableOf([col('_subkontoDt1', 'blockDt:1:0'), col('_noRole')])
    const { rowDefs, semantic } = buildBlockModel(table)
    expect(rowDefs).toHaveLength(1)
    expect(Object.values(rowDefs[0])).not.toContain('_noRole')
    expect(semantic).toEqual({})
  })

  it('обходит листья, вложенные в COLUMN_GROUP', () => {
    const table = tableOf([
      group('ДЕБЕТ', [
        col('_accountDtCode', 'accountDt'),
        col('_subkontoDt1', 'blockDt:1:0'),
      ]),
      group('КРЕДИТ', [col('_subkontoKt1', 'blockKt:1:0')]),
    ])
    const { rowDefs, semantic } = buildBlockModel(table)
    expect(rowDefs).toEqual([
      {
        subDt: '_subkontoDt1',
        subKt: '_subkontoKt1',
        a1Dt: '',
        a1Kt: '',
        a2Dt: '',
        a2Kt: '',
      },
    ])
    expect(semantic).toEqual({ accountDt: '_accountDtCode' })
  })
})
