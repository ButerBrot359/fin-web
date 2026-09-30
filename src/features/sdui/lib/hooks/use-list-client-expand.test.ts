import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import type { ListSource } from '../../ui/nodes/composite/list-column-defs'
import { useListClientExpand } from './use-list-client-expand'

const treeNode = (expandMode?: string): ViewNode =>
  ({
    id: 'panel.choice.parent.list',
    type: 'LIST',
    props: { displayMode: 'TREE', ...(expandMode ? { expandMode } : {}) },
  }) as ViewNode

const source = (expanded?: string): ListSource =>
  ({
    url: '/api/dictionaries/entries/Banki/search',
    method: 'POST',
    params: {
      view: 'tree',
      groupsOnly: 'true',
      ...(expanded ? { expanded } : {}),
    },
  }) as ListSource

describe('useListClientExpand (SCRUM-360 #3, панель «Родитель»)', () => {
  it('вне режима CLIENT не активен: params undefined, колбэка нет', () => {
    const { result } = renderHook(() =>
      useListClientExpand(treeNode(), source())
    )
    expect(result.current.isClientExpand).toBe(false)
    expect(result.current.params).toBeUndefined()
    expect(result.current.onToggleExpand).toBeUndefined()
  })

  it('серверный сид из params.expanded попадает в начальное множество', () => {
    const { result } = renderHook(() =>
      useListClientExpand(treeNode('CLIENT'), source('7, 12'))
    )
    expect(result.current.params).toEqual({
      view: 'tree',
      groupsOnly: 'true',
      expanded: '7,12',
    })
  })

  it('раскрытие добавляет id в CSV, свёртка убирает; параметры источника целы', () => {
    const { result } = renderHook(() =>
      useListClientExpand(treeNode('CLIENT'), source())
    )
    act(() => {
      result.current.onToggleExpand?.(5, true)
    })
    act(() => {
      result.current.onToggleExpand?.(3, true)
    })
    expect(result.current.params).toEqual({
      view: 'tree',
      groupsOnly: 'true',
      expanded: '3,5',
    })

    act(() => {
      result.current.onToggleExpand?.(5, false)
    })
    expect(result.current.params).toEqual({
      view: 'tree',
      groupsOnly: 'true',
      expanded: '3',
    })
  })

  it('пустое множество не эмитит ключ expanded вовсе', () => {
    const { result } = renderHook(() =>
      useListClientExpand(treeNode('CLIENT'), source('9'))
    )
    act(() => {
      result.current.onToggleExpand?.(9, false)
    })
    expect(result.current.params).toEqual({ view: 'tree', groupsOnly: 'true' })
  })
})
