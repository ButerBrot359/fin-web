import { act, renderHook } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useManualColumnResize } from './use-manual-column-resize'

const handleWithZoom = (zoom?: number) => {
  const el = document.createElement('div')
  if (zoom != null) Object.defineProperty(el, 'currentCSSZoom', { value: zoom })
  return el
}

const mouseDown = (target: HTMLElement, clientX: number) =>
  ({
    clientX,
    currentTarget: target,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as ReactMouseEvent<HTMLDivElement>

const setup = () => {
  const onResize = vi.fn()
  const { result } = renderHook(() =>
    useManualColumnResize({
      getWidth: () => 200,
      getMinWidth: () => 40,
      onResize,
    })
  )
  return { result, onResize }
}

afterEach(() => {
  document.dispatchEvent(new MouseEvent('mouseup'))
})

describe('useManualColumnResize', () => {
  it('без масштаба ширина меняется ровно на сдвиг курсора', () => {
    const { result, onResize } = setup()

    act(() => {
      result.current.mouseDownHandler('A')(mouseDown(handleWithZoom(), 100))
    })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }))

    expect(onResize).toHaveBeenLastCalledWith('A', 250)
  })

  it('при масштабе 150% сдвиг курсора переводится в px таблицы', () => {
    const { result, onResize } = setup()

    act(() => {
      result.current.mouseDownHandler('A')(mouseDown(handleWithZoom(1.5), 100))
    })
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 250 }))

    expect(onResize).toHaveBeenLastCalledWith('A', 300)
  })
})
