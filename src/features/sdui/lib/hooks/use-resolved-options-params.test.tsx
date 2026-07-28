import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useResolvedOptionsParams } from './use-resolved-options-params'
import { useViewStateStore } from '../stores/view-state-store'

afterEach(cleanup)

beforeEach(() => {
  useViewStateStore.getState().replaceAll({})
})

describe('useResolvedOptionsParams (root store)', () => {
  it('статический параметр проходит как есть', () => {
    const { result } = renderHook(() =>
      useResolvedOptionsParams({ Status: 'active' }),
    )
    expect(result.current).toEqual({ Status: 'active' })
  })

  it('{ fromBinding } резолвится из стейта формы', () => {
    useViewStateStore.getState().replaceAll({ Kontragent: { id: 55 } })
    const { result } = renderHook(() =>
      useResolvedOptionsParams({ Vladelets: { fromBinding: 'Kontragent' } }),
    )
    expect(result.current).toEqual({ Vladelets: '55' })
  })

  it('реактивность: смена поля-источника меняет резолвнутый параметр', () => {
    useViewStateStore.getState().replaceAll({ Kontragent: { id: 1 } })
    const { result } = renderHook(() =>
      useResolvedOptionsParams({ Vladelets: { fromBinding: 'Kontragent' } }),
    )
    expect(result.current).toEqual({ Vladelets: '1' })

    act(() => {
      useViewStateStore.getState().set('Kontragent', { id: 2 })
    })
    expect(result.current).toEqual({ Vladelets: '2' })
  })

  it('undefined params → пустой объект', () => {
    const { result } = renderHook(() => useResolvedOptionsParams(undefined))
    expect(result.current).toEqual({})
  })
})
