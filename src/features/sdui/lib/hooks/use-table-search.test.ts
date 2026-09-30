import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTableSearch, type TableSearchColumn } from './use-table-search'

const columns: TableSearchColumn[] = [
  { id: 'col-name', binding: 'Name' },
  { id: 'col-ref', binding: 'VychetIPN' },
]

const rows = [
  {
    rowId: 'r1',
    Name: 'Оклад',
    VychetIPN: { id: 1, presentation: 'Вычет на обучение' },
  },
  {
    rowId: 'r2',
    Name: 'Надбавка',
    VychetIPN: { id: 2, presentation: 'Стандартный вычет' },
  },
  { rowId: 'r3', Name: 'надбавка за стаж', VychetIPN: null },
]

describe('useTableSearch (SCRUM-302)', () => {
  it('пустой запрос — нет совпадений и подсветки', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    expect(result.current.matches).toEqual([])
    expect(result.current.current).toBeNull()
  })

  it('матчит без регистра и по presentation ссылочной ячейки', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    act(() => {
      result.current.setQuery('вычет')
    })
    expect(result.current.matches).toEqual([
      { rowId: 'r1', columnId: 'col-ref' },
      { rowId: 'r2', columnId: 'col-ref' },
    ])
    expect(result.current.current).toEqual({ rowId: 'r1', columnId: 'col-ref' })
  })

  it('next циклит по совпадениям', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    act(() => {
      result.current.setQuery('надбавка')
    })
    expect(result.current.current?.rowId).toBe('r2')
    act(() => {
      result.current.next()
    })
    expect(result.current.current?.rowId).toBe('r3')
    act(() => {
      result.current.next()
    })
    expect(result.current.current?.rowId).toBe('r2')
  })

  it('смена запроса сбрасывает позицию, clear убирает всё', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    act(() => {
      result.current.setQuery('надбавка')
    })
    act(() => {
      result.current.next()
    })
    act(() => {
      result.current.setQuery('оклад')
    })
    expect(result.current.current).toEqual({
      rowId: 'r1',
      columnId: 'col-name',
    })
    act(() => {
      result.current.clear()
    })
    expect(result.current.query).toBe('')
    expect(result.current.current).toBeNull()
  })

  it('несколько под-колонок одной ячейки дают одно совпадение', () => {
    const groupColumns: TableSearchColumn[] = [
      { id: 'grp', binding: 'IstochnikFinansirovaniya' },
      { id: 'grp', binding: 'FKR' },
    ]
    const groupRows = [
      {
        rowId: 'r1',
        IstochnikFinansirovaniya: { id: 1, presentation: '111 Бюджет' },
        FKR: { id: 2, presentation: '111' },
      },
    ]
    const { result } = renderHook(() => useTableSearch(groupRows, groupColumns))
    act(() => {
      result.current.setQuery('111')
    })
    expect(result.current.matches).toEqual([{ rowId: 'r1', columnId: 'grp' }])
  })

  it('отбирает строки с совпадением, без запроса отдаёт все', () => {
    const { result } = renderHook(() => useTableSearch(rows, columns))
    expect(result.current.rows).toBe(rows)
    act(() => {
      result.current.setQuery('НАДБАВКА')
    })
    expect(result.current.rows.map((r) => r.rowId)).toEqual(['r2', 'r3'])
    act(() => {
      result.current.clear()
    })
    expect(result.current.rows).toBe(rows)
  })

  it('строка, добавленная во время поиска, видна без совпадения', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useTableSearch(data, columns),
      { initialProps: { data: rows } }
    )
    act(() => {
      result.current.setQuery('оклад')
    })
    rerender({
      data: [...rows, { rowId: 'tmp-1', Name: '', VychetIPN: null }],
    })
    expect(result.current.rows.map((r) => r.rowId)).toEqual(['r1', 'tmp-1'])
  })

  it('найденная строка не пропадает, когда её правят в ходе поиска', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useTableSearch(data, columns),
      { initialProps: { data: rows } }
    )
    act(() => {
      result.current.setQuery('оклад')
    })
    rerender({
      data: rows.map((r) => (r.rowId === 'r1' ? { ...r, Name: 'Окла' } : r)),
    })
    expect(result.current.rows.map((r) => r.rowId)).toEqual(['r1'])
    expect(result.current.matches).toEqual([])
  })
})
