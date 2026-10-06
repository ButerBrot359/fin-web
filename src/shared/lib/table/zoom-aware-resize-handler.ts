import type {
  MouseEvent as ReactMouseEvent,
  TouchEvent as ReactTouchEvent,
} from 'react'

import { cssZoomOf } from '@/shared/lib/utils/css-zoom'

type ResizeHandler = (event: unknown) => void

interface ResizableHeader {
  getResizeHandler: (context?: Document) => ResizeHandler
}

type Listener = (event: Event) => void

const scaledTouches = (touches: ArrayLike<{ clientX: number }>, zoom: number) =>
  Array.from(touches, (touch) => ({ clientX: touch.clientX / zoom }))

const scaledEvent = (event: Event, zoom: number) => {
  if (typeof TouchEvent !== 'undefined' && event instanceof TouchEvent) {
    return {
      type: event.type,
      cancelable: event.cancelable,
      preventDefault: () => {
        event.preventDefault()
      },
      stopPropagation: () => {
        event.stopPropagation()
      },
      touches: scaledTouches(event.touches, zoom),
    }
  }
  return { type: event.type, clientX: (event as MouseEvent).clientX / zoom }
}

const zoomedDocument = (zoom: number): Document => {
  const wrapped = new Map<Listener, Listener>()
  return {
    addEventListener: (
      type: string,
      listener: Listener,
      options?: AddEventListenerOptions | boolean
    ) => {
      const scaled: Listener = (event) => {
        listener(scaledEvent(event, zoom) as unknown as Event)
      }
      wrapped.set(listener, scaled)
      document.addEventListener(type, scaled, options)
    },
    removeEventListener: (type: string, listener: Listener) => {
      const scaled = wrapped.get(listener)
      if (!scaled) return
      wrapped.delete(listener)
      document.removeEventListener(type, scaled)
    },
  } as unknown as Document
}

export const zoomAwareResizeHandler =
  (header: ResizableHeader) => (event: ReactMouseEvent | ReactTouchEvent) => {
    const zoom = cssZoomOf(event.currentTarget)
    if (zoom === 1) {
      header.getResizeHandler()(event)
      return
    }
    const start =
      'touches' in event
        ? {
            type: event.type,
            persist: () => {
              event.persist()
            },
            touches: scaledTouches(event.touches, zoom),
          }
        : {
            type: event.type,
            persist: () => {
              event.persist()
            },
            clientX: event.clientX / zoom,
          }
    header.getResizeHandler(zoomedDocument(zoom))(start)
  }
