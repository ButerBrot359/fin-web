import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useTableMultiSelection } from './use-table-multi-selection'

const stroki = (...ids: string[]) => ids.map((rowId) => ({ rowId }))

describe('useTableMultiSelection — выделение нескольких строк ТЧ (как в таблице 1С)', () => {
  it('обычный клик оставляет выделенной одну строку', () => {
    const { result } = renderHook(() =>
      useTableMultiSelection(stroki('a', 'b', 'c'))
    )

    act(() => {
      result.current.klik('a', 0, { ctrl: false, shift: false })
    })
    act(() => {
      result.current.klik('c', 2, { ctrl: false, shift: false })
    })

    expect(result.current.vydelennyeRowIds).toEqual(['c'])
  })

  it('Ctrl добавляет строку к выделению и снимает повторным кликом', () => {
    const { result } = renderHook(() =>
      useTableMultiSelection(stroki('a', 'b', 'c'))
    )

    act(() => {
      result.current.klik('a', 0, { ctrl: false, shift: false })
    })
    act(() => {
      result.current.klik('c', 2, { ctrl: true, shift: false })
    })
    expect(result.current.vydelennyeRowIds).toEqual(['a', 'c'])

    act(() => {
      result.current.klik('a', 0, { ctrl: true, shift: false })
    })
    expect(result.current.vydelennyeRowIds).toEqual(['c'])
  })

  it('Shift выделяет диапазон от якоря, в порядке видимого набора', () => {
    const { result } = renderHook(() =>
      useTableMultiSelection(stroki('a', 'b', 'c', 'd'))
    )

    act(() => {
      result.current.klik('d', 3, { ctrl: false, shift: false })
    })
    act(() => {
      result.current.klik('b', 1, { ctrl: false, shift: true })
    })

    expect(result.current.vydelennyeRowIds).toEqual(['b', 'c', 'd'])
  })

  it('Ctrl+A выделяет все видимые строки, tolkoOdna(null) снимает выделение', () => {
    const { result } = renderHook(() =>
      useTableMultiSelection(stroki('a', 'b', 'c'))
    )

    act(() => {
      result.current.vydelitVse()
    })
    expect(result.current.vydelennyeRowIds).toEqual(['a', 'b', 'c'])

    act(() => {
      result.current.tolkoOdna(null)
    })
    expect(result.current.vydelennyeRowIds).toEqual([])
  })

  it('исчезнувшие строки уходят из выделения — команда не уйдёт по чужому rowId', () => {
    const { result, rerender } = renderHook(
      ({ rows }: { rows: { rowId: string }[] }) => useTableMultiSelection(rows),
      { initialProps: { rows: stroki('a', 'b', 'c') } }
    )

    act(() => {
      result.current.vydelitVse()
    })
    rerender({ rows: stroki('a', 'c') })

    expect(result.current.vydelennyeRowIds).toEqual(['a', 'c'])
  })
})
