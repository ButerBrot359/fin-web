import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEventHandler, TouchEventHandler } from 'react'

/**
 * clientX первого касания или undefined, если касаний нет (touchcancel).
 * Параметр структурный, а не `TouchList`: у DOM-события и у React-события это
 * РАЗНЫЕ интерфейсы, а нужен из них только clientX. Через length, а не
 * `touches[0] === undefined`: в типах TouchList объявлен как всегда непустой.
 */
function firstTouchX(
  touches: ArrayLike<{ clientX: number }>
): number | undefined {
  return touches.length > 0 ? touches[0].clientX : undefined
}

export interface UseManualColumnResizeOptions {
  /** Ширина колонки на момент нажатия — база для дельты курсора. */
  getWidth: (columnId: string) => number
  /** Нижняя граница колонки (`props.minWidth` или дефолт). */
  getMinWidth: (columnId: string) => number
  /** Куда положить новую ширину (персист живёт в useSduiColumnSizing). */
  onResize: (columnId: string, width: number) => void
}

export interface UseManualColumnResizeResult {
  resizingColumnId: string | null
  mouseDownHandler: (columnId: string) => MouseEventHandler<HTMLDivElement>
  touchStartHandler: (columnId: string) => TouchEventHandler<HTMLDivElement>
}

/**
 * Перетаскивание границ колонок для таблиц, отрисованных БЕЗ TanStack Table
 * (`ReadOnlyTable`: ручная двухрядная шапка на MUI). Повторяет наблюдаемое
 * поведение `header.getResizeHandler()` в режиме `onChange` — ширина едет за
 * курсором — но ничего не знает про персист: он приходит колбэком `onResize`
 * из `useSduiColumnSizing`, чтобы не дублировать код localStorage.
 */
export function useManualColumnResize(
  options: UseManualColumnResizeOptions
): UseManualColumnResizeResult {
  const [resizingColumnId, setResizingColumnId] = useState<string | null>(null)

  // Опции читаются из слушателей document — держим их в ref, иначе drag
  // работал бы по замыканию того рендера, в котором начался.
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  }, [options])

  // Снятие слушателей: и по mouseup, и при размонтировании посреди drag'а.
  const detachRef = useRef<(() => void) | null>(null)
  useEffect(
    () => () => {
      detachRef.current?.()
    },
    []
  )

  const begin = useCallback((columnId: string, startX: number) => {
    const { getWidth, getMinWidth, onResize } = optionsRef.current
    const startWidth = getWidth(columnId)
    const minWidth = getMinWidth(columnId)

    const move = (clientX: number) => {
      const next = Math.max(minWidth, startWidth + (clientX - startX))
      optionsRef.current.onResize(columnId, Math.round(next))
    }
    // Первый onResize делаем сразу: ширина фиксируется даже если пользователь
    // нажал и отпустил без движения (иначе колонка «прыгнет» при следующем
    // ре-рендере от сервера, когда отклонения ещё нет).
    onResize(columnId, Math.round(Math.max(minWidth, startWidth)))

    const onMouseMove = (event: MouseEvent) => {
      move(event.clientX)
    }
    const onTouchMove = (event: TouchEvent) => {
      const clientX = firstTouchX(event.touches)
      if (clientX !== undefined) move(clientX)
    }
    const detach = () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
      detachRef.current = null
      setResizingColumnId(null)
    }
    function onEnd() {
      detach()
    }

    detachRef.current?.()
    detachRef.current = detach
    setResizingColumnId(columnId)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onTouchMove)
    document.addEventListener('touchend', onEnd)
    document.addEventListener('touchcancel', onEnd)
  }, [])

  const mouseDownHandler = useCallback(
    (columnId: string): MouseEventHandler<HTMLDivElement> =>
      (event) => {
        // Нажатие на ручке не должно ни выделять текст, ни попадать в заголовок.
        event.preventDefault()
        event.stopPropagation()
        begin(columnId, event.clientX)
      },
    [begin]
  )

  const touchStartHandler = useCallback(
    (columnId: string): TouchEventHandler<HTMLDivElement> =>
      (event) => {
        const clientX = firstTouchX(event.touches)
        if (clientX === undefined) return
        event.stopPropagation()
        begin(columnId, clientX)
      },
    [begin]
  )

  return { resizingColumnId, mouseDownHandler, touchStartHandler }
}
