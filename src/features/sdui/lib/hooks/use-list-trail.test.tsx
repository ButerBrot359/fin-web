import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../types/view'
import type { ListSource } from '../../ui/nodes/composite/list-column-defs'
import { useListTrail } from './use-list-trail'

// Уровни поддержаны только доменом DICTIONARY (см. list-hierarchy.HIERARCHY_SOURCE)
const HIER_URL = '/api/universaldomain-entries/DICTIONARY/Kontragenty/paged'

const hierSource = (params?: Record<string, string>): ListSource => ({
  url: HIER_URL,
  params,
})

const node = (props?: Record<string, unknown>): ViewNode => ({
  id: 'list.panel',
  type: 'LIST',
  props,
})

const render = (initialProps: {
  node: ViewNode
  source: ListSource | undefined
  debouncedSearch: string
}) => renderHook((props) => useListTrail(props), { initialProps })

describe('useListTrail', () => {
  it('стартует с серверного пути и выделения (selectedPath/selectedId)', () => {
    const { result } = render({
      node: node({
        selectedId: 42,
        selectedPath: [{ id: 5, presentation: 'Папка' }],
      }),
      source: hierSource(),
      debouncedSearch: '',
    })

    expect(result.current.selectedRowId).toBe(42)
    expect(result.current.trail).toEqual([{ id: 5, label: 'Папка' }])
    expect(result.current.isHierarchical).toBe(true)
    // Уровень запроса — последняя папка пути
    expect(result.current.levelParams).toEqual({ parent: '5' })
  })

  it('провал в папку добавляет сегмент и сбрасывает выделение', () => {
    const { result } = render({
      node: node(),
      source: hierSource(),
      debouncedSearch: '',
    })

    act(() => {
      result.current.setSelectedRowId(7)
    })
    expect(result.current.selectedRowId).toBe(7)

    const folder = { id: 10, isGroup: true, presentation: 'Договоры' }
    expect(result.current.canDrillInto(folder)).toBe(true)

    act(() => {
      result.current.drillInto(folder)
    })
    expect(result.current.selectedRowId).toBeNull()
    expect(result.current.trail).toEqual([{ id: 10, label: 'Договоры' }])
    expect(result.current.levelParams).toEqual({ parent: '10' })

    // Хлебные крошки: возврат на корень режет путь и снимает выделение
    act(() => {
      result.current.navigateToDepth(0)
    })
    expect(result.current.trail).toEqual([])
    expect(result.current.levelParams).toEqual({})
  })

  it('поиск уплощает уровни (parent уходит), путь при этом сохраняется', () => {
    const { result, rerender } = render({
      node: node({ selectedPath: [{ id: 5, presentation: 'Папка' }] }),
      source: hierSource(),
      debouncedSearch: '',
    })
    expect(result.current.levelParams).toEqual({ parent: '5' })

    rerender({ node: node(), source: hierSource(), debouncedSearch: 'ива' })
    expect(result.current.isSearchMode).toBe(true)
    expect(result.current.levelParams).toEqual({})
    expect(result.current.canDrillInto({ id: 10, isGroup: true })).toBe(false)

    // Очистили поиск — вернулись на свой уровень
    rerender({ node: node(), source: hierSource(), debouncedSearch: '' })
    expect(result.current.levelParams).toEqual({ parent: '5' })
  })

  it('смена идентичности source сбрасывает выделение (SCRUM-291 M5), первый рендер — нет', () => {
    const { result, rerender } = render({
      node: node({ selectedId: 42 }),
      source: hierSource(),
      debouncedSearch: '',
    })
    // Первый рендер не трогает серверное выделение
    expect(result.current.selectedRowId).toBe(42)

    // Тот же source — выделение живо
    rerender({ node: node(), source: hierSource(), debouncedSearch: '' })
    expect(result.current.selectedRowId).toBe(42)

    // Сервер заменил source (setProp-патч) — выделение сброшено
    rerender({
      node: node(),
      source: hierSource({ filter: 'x' }),
      debouncedSearch: '',
    })
    expect(result.current.selectedRowId).toBeNull()
  })

  it('неиерархический источник: params отдаются как есть, провалов нет', () => {
    const params = { size: '25' }
    const { result } = render({
      node: node(),
      source: { url: '/api/documents/paged', params },
      debouncedSearch: '',
    })

    expect(result.current.isHierarchical).toBe(false)
    expect(result.current.levelParams).toBe(params)
    expect(result.current.canDrillInto({ id: 1, isGroup: true })).toBe(false)
  })
})
