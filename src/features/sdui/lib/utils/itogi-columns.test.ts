import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import {
  extractItogiColumns,
  formatItogiValue,
  itogiBodyCells,
  itogiTreeLayout,
  type ItogiColumn,
  type ItogiRow,
} from './itogi-columns'

const column = (
  binding: string,
  dataType: string,
  props: Record<string, unknown> = {}
): ViewNode =>
  ({
    id: 'table.itogi.col.' + binding,
    type: 'TABLE_COLUMN',
    binding,
    props: { label: binding, dataType, ...props },
  }) as unknown as ViewNode

const children = [
  column('NomerPoPoryadku', 'INTEGER'),
  column('Derevo', 'STRING'),
  column('DerevoPravo', 'STRING'),
  column('Nachisleno', 'DECIMAL', { precision: 2 }),
  column('KVyplate', 'DECIMAL', { precision: 2, textColor: '#0000FF' }),
  column('Skrytaya', 'DECIMAL', { visible: false }),
]

const columns = extractItogiColumns(children)
const layout = itogiTreeLayout(columns)
const sum = columns[3]

const row = (extra: Record<string, unknown>): ItogiRow => ({
  rowId: 'r',
  __level: 0,
  __parentRowId: null,
  ...extra,
})

const spans = (r: ItogiRow) =>
  itogiBodyCells(columns, layout, r).map(
    (c) => `${c.column.binding}${c.colSpan > 1 ? '×' + String(c.colSpan) : ''}`
  )

describe('extractItogiColumns', () => {
  it('берёт видимые колонки с типом, разрядностью и цветом текста', () => {
    expect(columns.map((c) => c.binding)).toEqual([
      'NomerPoPoryadku',
      'Derevo',
      'DerevoPravo',
      'Nachisleno',
      'KVyplate',
    ])
    expect(sum).toMatchObject({ numeric: true, precision: 2 })
    expect(columns[4].textColor).toBe('#0000FF')
    expect(columns[1].numeric).toBe(false)
  })
})

describe('itogiTreeLayout', () => {
  it('колонка-дерево — первая нечисловая, номер слева, правая часть справа', () => {
    expect(layout).toEqual({ numberIndex: 0, treeIndex: 1, rightIndex: 2 })
  })

  it('без нечисловых колонок дерева нет', () => {
    expect(itogiTreeLayout([sum])).toEqual({
      numberIndex: -1,
      treeIndex: -1,
      rightIndex: -1,
    })
  })
})

describe('formatItogiValue', () => {
  it('разряды через пробел, запятая, два знака', () => {
    expect(formatItogiValue(1018173, sum)).toBe('1 018 173,00')
    expect(formatItogiValue(559146.8, sum)).toBe('559 146,80')
    expect(formatItogiValue('11896.8', sum)).toBe('11 896,80')
    expect(formatItogiValue(-1234.5, sum)).toBe('-1 234,50')
  })

  it('null и 0 — пустая ячейка', () => {
    expect(formatItogiValue(null, sum)).toBe('')
    expect(formatItogiValue(undefined, sum)).toBe('')
    expect(formatItogiValue(0, sum)).toBe('')
    expect(formatItogiValue('0', sum)).toBe('')
  })

  it('номер без разрядности печатается целым, строки — как есть', () => {
    expect(formatItogiValue(3, columns[0])).toBe('3')
    expect(formatItogiValue('01.09.2026', columns[2])).toBe('01.09.2026')
    expect(
      formatItogiValue({ id: 1, presentation: 'Альбина' }, columns[1])
    ).toBe('Альбина')
  })
})

describe('itogiBodyCells', () => {
  it('физлицо: номер отдельно, ФИО на обе колонки дерева', () => {
    expect(
      spans(
        row({
          __gruppirovka: 'FizicheskoeLitso',
          NomerPoPoryadku: 3,
          Derevo: 'Асанов Ринат Саинович',
          DerevoPravo: null,
        })
      )
    ).toEqual(['NomerPoPoryadku', 'Derevo×2', 'Nachisleno', 'KVyplate'])
  })

  it('подразделение и период — каждая в своей колонке', () => {
    expect(
      spans(
        row({
          __gruppirovka: 'PodrazdeleniePeriod',
          Derevo: 'Альбина',
          DerevoPravo: '01.09.2026',
        })
      )
    ).toEqual([
      'NomerPoPoryadku',
      'Derevo',
      'DerevoPravo',
      'Nachisleno',
      'KVyplate',
    ])
  })

  it('вид начисления и «Итого» начинаются с колонки номера', () => {
    const expected = ['Derevo×3', 'Nachisleno', 'KVyplate']
    expect(
      spans(row({ __gruppirovka: 'VidNachisleniya', Derevo: 'Оклад' }))
    ).toEqual(expected)
    expect(spans(row({ __gruppirovka: 'Itogo', Derevo: 'Итого' }))).toEqual(
      expected
    )
  })

  it('«Удержания…» с пустой правой частью занимает обе колонки дерева', () => {
    expect(
      spans(
        row({
          __gruppirovka: 'SotrudnikDolzhnost',
          Derevo: 'Удержания, налоги, взносы и отчисления',
          DerevoPravo: '',
        })
      )
    ).toEqual(['NomerPoPoryadku', 'Derevo×2', 'Nachisleno', 'KVyplate'])
  })

  it('без колонки номера вид начисления ничего лишнего не объединяет', () => {
    const bezNomera: ItogiColumn[] = columns.slice(1)
    const l = itogiTreeLayout(bezNomera)
    const cells = itogiBodyCells(
      bezNomera,
      l,
      row({ __gruppirovka: 'VidNachisleniya', Derevo: 'Оклад' })
    )
    expect(cells.map((c) => c.colSpan)).toEqual([2, 1, 1])
  })
})
