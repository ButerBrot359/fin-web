import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../../types/view'
import { readPagination, isPagedNode, readVirtualization } from './pagination'

function node(props?: Record<string, unknown>): ViewNode {
  return { id: 'n1', type: 'TABLE', props }
}

describe('readPagination (SCRUM-368)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('нет props.pagination — null (INLINE-путь)', () => {
    expect(readPagination(node())).toBeNull()
    expect(readPagination(node({ pagination: null }))).toBeNull()
    expect(isPagedNode(node())).toBe(false)
  })

  it('валидный PAGED-конфиг читается целиком', () => {
    const pagination = {
      mode: 'PAGED',
      loadTrigger: 'INFINITE_SCROLL',
      pageSize: 200,
      source: { url: '/api/x/movements', method: 'GET' },
    }
    expect(readPagination(node({ pagination }))).toEqual(pagination)
    expect(isPagedNode(node({ pagination }))).toBe(true)
  })

  it('PAGED без source.url — warn + null (fail-safe в INLINE)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(readPagination(node({ pagination: { mode: 'PAGED' } }))).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  it('неизвестный mode — warn + null', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(readPagination(node({ pagination: { mode: 'CURSOR' } }))).toBeNull()
    expect(warn).toHaveBeenCalled()
  })

  it('readVirtualization: ON/OFF читаются, прочее — AUTO', () => {
    expect(readVirtualization(node({ virtualization: 'ON' }))).toBe('ON')
    expect(readVirtualization(node({ virtualization: 'OFF' }))).toBe('OFF')
    expect(readVirtualization(node({ virtualization: 'какой-то' }))).toBe(
      'AUTO'
    )
    expect(readVirtualization(node())).toBe('AUTO')
  })
})
