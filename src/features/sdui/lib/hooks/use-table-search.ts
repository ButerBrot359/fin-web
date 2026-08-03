import { useRef, useState } from 'react'

import type { TableRow } from './use-table-sync'

export interface TableSearchColumn {
  id: string
  binding: string
}

export interface TableSearchMatch {
  rowId: string
  columnId: string
}

// Проверка «эта ячейка — текущее совпадение поиска». Живёт здесь (а не в
// компонентном table-search-cell.tsx), чтобы не ловить react-refresh warning
// за экспорт функции рядом с компонентом.
export function isSearchHit(
  match: TableSearchMatch | null,
  rowId: string,
  columnId: string
): boolean {
  if (!match) return false
  return match.rowId === rowId && match.columnId === columnId
}

export interface TableSearchApi {
  query: string
  setQuery: (q: string) => void
  matches: TableSearchMatch[]
  current: TableSearchMatch | null
  next: () => void
  clear: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
  focusInput: () => void
}

// Примитив → строка. Явные ветки по typeof вместо String(unknown) — иначе
// объекты стрингифицируются в бесполезное "[object Object]".
function primitiveToText(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return ''
}

// Текст ячейки для матчинга: ссылочные значения ({id, presentation}) — по
// presentation, остальное — строкой. Поиск 1С не фильтрует строки (§6.5),
// поэтому результат — координаты ячеек, а не отобранные строки.
function cellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    const presentation = (value as { presentation?: unknown }).presentation
    return primitiveToText(presentation)
  }
  return primitiveToText(value)
}

export function useTableSearch(
  rows: TableRow[],
  columns: TableSearchColumn[]
): TableSearchApi {
  const [query, setQueryState] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Пересчёт на каждый рендер сознательно: ТЧ — десятки строк, мемоизация
  // не окупается.
  const q = query.trim().toLowerCase()
  const matches: TableSearchMatch[] = []
  if (q) {
    for (const row of rows) {
      for (const col of columns) {
        if (cellText(row[col.binding]).toLowerCase().includes(q)) {
          matches.push({ rowId: row.rowId, columnId: col.id })
        }
      }
    }
  }

  const current = matches.length > 0 ? matches[index % matches.length] : null

  const setQuery = (next: string) => {
    setQueryState(next)
    setIndex(0)
  }

  return {
    query,
    setQuery,
    matches,
    current,
    next: () => {
      setIndex((i) => (i + 1) % Math.max(matches.length, 1))
    },
    clear: () => {
      setQueryState('')
      setIndex(0)
    },
    inputRef,
    focusInput: () => inputRef.current?.focus(),
  }
}
