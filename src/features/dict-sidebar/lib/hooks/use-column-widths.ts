import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'

/** Минимальная ширина колонки при ресайзе (px). */
const MIN_WIDTH = 64

const storageKey = (typeCode: string) => `dict-sidebar-col-widths:${typeCode}`

const readStored = (typeCode: string): Record<string, number> => {
  try {
    const raw = localStorage.getItem(storageKey(typeCode))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, number>)
      : {}
  } catch {
    return {}
  }
}

/**
 * Изменяемая ширина колонок диалога справочника, сохраняемая per-справочник в
 * localStorage (эталон 1С — тянем границы заголовков мышью). Колонки без
 * сохранённого значения берут `defaultWidth`. Возвращает карту ширин и
 * `startResize` — обработчик mousedown на хэндле правой границы заголовка.
 */
export const useColumnWidths = (typeCode: string, defaultWidth = 180) => {
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    readStored(typeCode)
  )

  // Перечитываем при смене справочника (диалог переиспользуется под разные типы).
  useEffect(() => {
    setWidths(readStored(typeCode))
  }, [typeCode])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey(typeCode), JSON.stringify(widths))
    } catch {
      // localStorage недоступен (private mode) — работаем без персиста.
    }
  }, [typeCode, widths])

  const widthOf = useCallback(
    (columnId: string) => widths[columnId] ?? defaultWidth,
    [widths, defaultWidth]
  )

  // Активный ресайз держим в ref, чтобы слушатели document не пересоздавались.
  const dragRef = useRef<{ columnId: string; startX: number; startWidth: number } | null>(
    null
  )

  const startResize = useCallback(
    (columnId: string, event: ReactMouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      dragRef.current = {
        columnId,
        startX: event.clientX,
        startWidth: widths[columnId] ?? defaultWidth,
      }

      const onMove = (e: MouseEvent) => {
        const drag = dragRef.current
        if (!drag) return
        const next = Math.max(MIN_WIDTH, drag.startWidth + (e.clientX - drag.startX))
        setWidths((prev) => ({ ...prev, [drag.columnId]: next }))
      }
      const onUp = () => {
        dragRef.current = null
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        document.body.style.userSelect = ''
      }

      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    },
    [widths, defaultWidth]
  )

  return { widthOf, startResize }
}
