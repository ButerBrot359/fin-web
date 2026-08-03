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
})
