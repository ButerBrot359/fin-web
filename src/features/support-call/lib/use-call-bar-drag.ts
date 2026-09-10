import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react'

export interface FloatingCallPosition {
  x: number
  y: number
}
const EDGE = 8
export function clampCallPosition(
  position: FloatingCallPosition,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number
): FloatingCallPosition {
  return {
    x: Math.max(
      EDGE,
      Math.min(position.x, Math.max(EDGE, viewportWidth - width - EDGE))
    ),
    y: Math.max(
      EDGE,
      Math.min(position.y, Math.max(EDGE, viewportHeight - height - EDGE))
    ),
  }
}

export function useCallBarDrag(
  position: FloatingCallPosition | null,
  onPositionChange: (position: FloatingCallPosition) => void
) {
  const elementRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{
    pointerId: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const clamp = useCallback((next: FloatingCallPosition) => {
    const element = elementRef.current
    if (!element) return next
    return clampCallPosition(
      next,
      element.offsetWidth,
      element.offsetHeight,
      window.innerWidth,
      window.innerHeight
    )
  }, [])
  useLayoutEffect(() => {
    const element = elementRef.current
    if (!element) return
    const keepVisible = () => {
      const current = position ?? {
        x: window.innerWidth - element.offsetWidth - 24,
        y: window.innerHeight - element.offsetHeight - 64,
      }
      const next = clamp(current)
      if (next.x !== current.x || next.y !== current.y) onPositionChange(next)
    }
    keepVisible()
    const observer = new ResizeObserver(keepVisible)
    observer.observe(element)
    window.addEventListener('resize', keepVisible)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', keepVisible)
    }
  }, [position, onPositionChange, clamp])
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || !elementRef.current) return
    if ((event.target as HTMLElement).closest('button,a,input')) return
    const element = elementRef.current
    const rect = element.getBoundingClientRect()
    drag.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    event.preventDefault()
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current
    if (event.pointerId !== active?.pointerId) return
    onPositionChange(
      clamp({
        x: event.clientX - active.offsetX,
        y: event.clientY - active.offsetY,
      })
    )
  }
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    drag.current = null
    setIsDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return {
    elementRef,
    isDragging,
    handleProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
    },
  }
}
