import { useEffect, useRef, useState } from 'react'

export interface UseStickyHeadOffsetResult {
  /** Отступ sticky-ячеек второго ряда шапки от верха контейнера. */
  headTopOffset: number
  /** Вешать на ПЕРВЫЙ ряд шапки (`<tr>`). */
  setFirstHeadRowRef: (row: HTMLTableRowElement | null) => void
}

/**
 * Высота ПЕРВОГО ряда шапки: второй ряд двухуровневой шапки прилипает под ним
 * (MUI задаёт всем sticky-ячейкам top:0, и без смещения ряды наложились бы).
 * Замер, а не константа: высота ряда зависит от шрифта, переносов подписи и
 * масштаба страницы. ResizeObserver — потому что подписи переносятся при
 * ресайзе колонок, то есть высота меняется без перемонтирования.
 */
export function useStickyHeadOffset(): UseStickyHeadOffsetResult {
  const firstHeadRowObserver = useRef<ResizeObserver | null>(null)
  useEffect(
    () => () => {
      firstHeadRowObserver.current?.disconnect()
    },
    []
  )

  const [headTopOffset, setHeadTopOffset] = useState(0)
  const setFirstHeadRowRef = (row: HTMLTableRowElement | null) => {
    firstHeadRowObserver.current?.disconnect()
    if (!row) return
    setHeadTopOffset(row.offsetHeight)
    // jsdom (юнит-тесты) ResizeObserver не даёт — там достаточно замера выше.
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      setHeadTopOffset(row.offsetHeight)
    })
    observer.observe(row)
    firstHeadRowObserver.current = observer
  }

  return { headTopOffset, setFirstHeadRowRef }
}
