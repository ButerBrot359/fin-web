import { useEffect, useState } from 'react'
import type { ColumnSizingState, OnChangeFn } from '@tanstack/react-table'

const keyFor = (id: string) => `tp-col-widths:${id}`

const readStored = (id: string): ColumnSizingState => {
  try {
    const raw = localStorage.getItem(keyFor(id))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as ColumnSizingState)
      : {}
  } catch {
    return {}
  }
}

/**
 * Персист ширин колонок табличной части (per-ТЧ, localStorage) для встроенного
 * ресайза TanStack Table — эталон 1С: границы колонок тянутся мышью и запоминаются.
 *
 * `storageId` — уникальный ключ ТЧ (код типа-строки, напр.
 * `PostuplenieOtKontragenta_OsnovnyeSredstva`). Пустой `storageId` → ресайз
 * работает, но без сохранения между открытиями.
 *
 * Возвращает `columnSizing`/`onColumnSizingChange` для контролируемого состояния
 * `useReactTable` (`state.columnSizing` + `onColumnSizingChange`).
 */
export const usePersistedColumnSizing = (storageId: string) => {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() =>
    storageId ? readStored(storageId) : {}
  )

  // Перечитываем при смене ТЧ (компонент может переиспользоваться под разные типы).
  useEffect(() => {
    setColumnSizing(storageId ? readStored(storageId) : {})
  }, [storageId])

  useEffect(() => {
    if (!storageId) return
    try {
      localStorage.setItem(keyFor(storageId), JSON.stringify(columnSizing))
    } catch {
      // localStorage недоступен (private mode) — работаем без персиста.
    }
  }, [storageId, columnSizing])

  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = setColumnSizing

  return { columnSizing, onColumnSizingChange }
}
