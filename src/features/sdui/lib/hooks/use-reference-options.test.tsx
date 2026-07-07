import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { SelectOption } from '@/shared/types/select-option'
import { useReferenceOptions } from './use-reference-options'

const opt = (id: number): SelectOption => ({
  id,
  code: String(id),
  label: `Опция ${id}`,
})

describe('useReferenceOptions', () => {
  it('load загружает опции, resetOptions сбрасывает кэш', async () => {
    const fetcher = vi.fn().mockResolvedValue([opt(1)])
    const { result } = renderHook(() => useReferenceOptions(fetcher, 'k'))

    act(() => result.current.load())
    await waitFor(() => expect(result.current.options).toEqual([opt(1)]))
    expect(result.current.loading).toBe(false)

    act(() => result.current.resetOptions())
    expect(result.current.options).toEqual([])
  })

  it('смена resetKey сбрасывает опции', async () => {
    const fetcher = vi.fn().mockResolvedValue([opt(1)])
    const { result, rerender } = renderHook(
      ({ key }) => useReferenceOptions(fetcher, key),
      { initialProps: { key: 'a' } },
    )
    act(() => result.current.load())
    await waitFor(() => expect(result.current.options).toHaveLength(1))

    rerender({ key: 'b' })
    await waitFor(() => expect(result.current.options).toEqual([]))
  })

  it('seq-гвард: поздний ответ раннего запроса не перетирает свежие опции', async () => {
    let resolveFirst!: (v: SelectOption[]) => void
    const first = new Promise<SelectOption[]>((r) => {
      resolveFirst = r
    })
    const fetcher = vi
      .fn<(search?: string) => Promise<SelectOption[]>>()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce([opt(2)])
    const { result } = renderHook(() => useReferenceOptions(fetcher, 'k'))

    act(() => result.current.load('первый'))
    act(() => result.current.load('второй'))
    await waitFor(() => expect(result.current.options).toEqual([opt(2)]))

    // Первый (ранний) запрос отвечает ПОЗЖЕ второго — его ответ игнорируется
    await act(async () => {
      resolveFirst([opt(1)])
    })
    expect(result.current.options).toEqual([opt(2)])
  })

  it('ошибка fetch глотается: options пустые, loading false', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useReferenceOptions(fetcher, 'k'))

    act(() => result.current.load())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.options).toEqual([])
  })
})
