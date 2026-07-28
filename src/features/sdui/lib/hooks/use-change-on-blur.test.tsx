import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useChangeOnBlur } from './use-change-on-blur'

describe('useChangeOnBlur', () => {
  it('blur без изменения значения (после focus) → change НЕ шлётся', () => {
    const fire = vi.fn()
    const { result } = renderHook(() =>
      useChangeOnBlur({ fireServerEvent: fire }, 'Иванов'),
    )
    act(() => {
      result.current.onFocus()
    })
    act(() => {
      result.current.onBlur()
    })
    expect(fire).not.toHaveBeenCalled()
  })

  it('focus → значение изменилось → blur шлёт change с новым значением', () => {
    const fire = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useChangeOnBlur({ fireServerEvent: fire }, value),
      { initialProps: { value: 'Ив' } },
    )
    act(() => {
      result.current.onFocus()
    }) // запомнили 'Ив'
    rerender({ value: 'Иванов' }) // пользователь дописал
    act(() => {
      result.current.onBlur()
    })
    expect(fire).toHaveBeenCalledExactlyOnceWith('change', 'Иванов')
  })

  it('сервер записал значение → focus → blur без правки → change НЕ шлётся (кейс просьбы №1)', () => {
    const fire = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useChangeOnBlur({ fireServerEvent: fire }, value),
      { initialProps: { value: '' } },
    )
    rerender({ value: 'Иванов Иван Иванович' }) // серверный setValue
    act(() => {
      result.current.onFocus()
    }) // юзер зашёл в поле
    act(() => {
      result.current.onBlur()
    }) // вышел, не трогая
    expect(fire).not.toHaveBeenCalled()
  })

  it('повторный цикл: после отправки новый focus сбрасывает базу сравнения', () => {
    const fire = vi.fn()
    const { result, rerender } = renderHook(
      ({ value }) => useChangeOnBlur({ fireServerEvent: fire }, value),
      { initialProps: { value: 'a' } },
    )
    act(() => {
      result.current.onFocus()
    })
    rerender({ value: 'b' })
    act(() => {
      result.current.onBlur()
    }) // a→b, шлёт
    expect(fire).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.onFocus()
    }) // запомнили 'b'
    act(() => {
      result.current.onBlur()
    }) // без правки
    expect(fire).toHaveBeenCalledTimes(1) // не выросло
  })

  it('null → null (пустое поле, blur без правки) не шлёт', () => {
    const fire = vi.fn()
    const { result } = renderHook(() =>
      useChangeOnBlur({ fireServerEvent: fire }, null),
    )
    act(() => {
      result.current.onFocus()
    })
    act(() => {
      result.current.onBlur()
    })
    expect(fire).not.toHaveBeenCalled()
  })
})
