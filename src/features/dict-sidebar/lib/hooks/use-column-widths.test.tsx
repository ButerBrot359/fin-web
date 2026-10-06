import { act, renderHook } from '@testing-library/react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useColumnWidths } from './use-column-widths'

const mouseDown = (clientX: number, zoom?: number) => {
  const el = document.createElement('div')
  if (zoom != null) Object.defineProperty(el, 'currentCSSZoom', { value: zoom })
  return {
    clientX,
    currentTarget: el,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as ReactMouseEvent
}

const drag = (
  startResize: (id: string, e: ReactMouseEvent) => void,
  from: number,
  to: number,
  zoom?: number
) => {
  act(() => {
    startResize('Naimenovanie', mouseDown(from, zoom))
  })
  act(() => {
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: to }))
    document.dispatchEvent(new MouseEvent('mouseup'))
  })
}

afterEach(() => {
  localStorage.clear()
})

describe('useColumnWidths', () => {
  it('без масштаба ширина меняется ровно на сдвиг курсора', () => {
    const { result } = renderHook(() => useColumnWidths('Kontragenty', 180))

    drag(result.current.startResize, 100, 160)

    expect(result.current.widthOf('Naimenovanie')).toBe(240)
  })

  it('при масштабе 150% сдвиг курсора переводится в px таблицы', () => {
    const { result } = renderHook(() => useColumnWidths('Kontragenty', 180))

    drag(result.current.startResize, 100, 250, 1.5)

    expect(result.current.widthOf('Naimenovanie')).toBe(280)
  })
})
