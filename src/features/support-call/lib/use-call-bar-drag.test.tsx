import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clampCallPosition,
  useCallBarDrag,
  type FloatingCallPosition,
} from './use-call-bar-drag'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('minimized call dragging', () => {
  it('clamps all edges including viewports smaller than the bar', () => {
    expect(clampCallPosition({ x: -20, y: 999 }, 288, 200, 390, 844)).toEqual({
      x: 8,
      y: 636,
    })
    expect(clampCallPosition({ x: 800, y: 800 }, 288, 200, 200, 100)).toEqual({
      x: 8,
      y: 8,
    })
  })
  it('moves only from the handle, handles touch cancel, and reclamps on resize', () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
      }
    )
    vi.stubGlobal(
      'PointerEvent',
      class extends MouseEvent {
        pointerId = 1
        isPrimary = true
      }
    )
    function Bar() {
      const [position, setPosition] = useState<FloatingCallPosition | null>({
        x: 100,
        y: 100,
      })
      const { elementRef, handleProps } = useCallBarDrag(position, setPosition)
      return (
        <div ref={elementRef}>
          <div data-testid="handle" {...handleProps}>
            <button>Control</button>
          </div>
          <output>{JSON.stringify(position)}</output>
        </div>
      )
    }
    render(<Bar />)
    const handle = screen.getByTestId('handle')
    handle.setPointerCapture = vi.fn()
    handle.hasPointerCapture = () => false
    fireEvent.pointerDown(screen.getByText('Control'), {
      clientX: 10,
      clientY: 10,
      button: 0,
    })
    fireEvent.pointerMove(handle, { clientX: 300, clientY: 300 })
    expect(screen.getByRole('status').textContent).toBe('{"x":100,"y":100}')
    fireEvent.pointerDown(handle, { clientX: 10, clientY: 10, button: 0 })
    fireEvent.pointerMove(handle, { clientX: 300, clientY: 300 })
    expect(screen.getByRole('status').textContent).toBe('{"x":290,"y":290}')
    fireEvent.pointerCancel(handle)
    fireEvent.pointerMove(handle, { clientX: 500, clientY: 500 })
    expect(screen.getByRole('status').textContent).toBe('{"x":290,"y":290}')
    vi.stubGlobal('innerWidth', 200)
    vi.stubGlobal('innerHeight', 200)
    act(() => {
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByRole('status').textContent).toBe('{"x":192,"y":192}')
  })
})
