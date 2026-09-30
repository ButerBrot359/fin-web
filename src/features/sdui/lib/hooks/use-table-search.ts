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
  rows: TableRow[]
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
// presentation, остальное — строкой.
function cellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object') {
    const presentation = (value as { presentation?: unknown }).presentation
    return primitiveToText(presentation)
  }
  return primitiveToText(value)
}

function naytiSovpadeniya(
  rows: TableRow[],
  columns: TableSearchColumn[],
  q: string
): TableSearchMatch[] {
  const matches: TableSearchMatch[] = []
  if (!q) return matches
  for (const row of rows) {
    for (const col of columns) {
      if (!cellText(row[col.binding]).toLowerCase().includes(q)) continue
      const last = matches.at(-1)
      if (last?.rowId === row.rowId && last.columnId === col.id) continue
      matches.push({ rowId: row.rowId, columnId: col.id })
    }
  }
  return matches
}

interface SnimokPoiska {
  izvestnye: ReadonlySet<string>
  naydennye: ReadonlySet<string>
}

export function useTableSearch(
  rows: TableRow[],
  columns: TableSearchColumn[]
): TableSearchApi {
  const [query, setQueryState] = useState('')
  const [index, setIndex] = useState(0)
  const [snimok, setSnimok] = useState<SnimokPoiska | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Пересчёт на каждый рендер сознательно: ТЧ — десятки строк, мемоизация
  // не окупается.
  const q = query.trim().toLowerCase()
  const matches = naytiSovpadeniya(rows, columns, q)

  const current = matches.length > 0 ? matches[index % matches.length] : null

  const sovpavshie = new Set(matches.map((m) => m.rowId))
  const otobrannye = q
    ? rows.filter(
        (row) =>
          sovpavshie.has(row.rowId) ||
          snimok === null ||
          snimok.naydennye.has(row.rowId) ||
          !snimok.izvestnye.has(row.rowId)
      )
    : rows

  const sbrosit = (next: string) => {
    setQueryState(next)
    setIndex(0)
    const nextQ = next.trim().toLowerCase()
    setSnimok(
      nextQ
        ? {
            izvestnye: new Set(rows.map((r) => r.rowId)),
            naydennye: new Set(
              naytiSovpadeniya(rows, columns, nextQ).map((m) => m.rowId)
            ),
          }
        : null
    )
  }

  return {
    query,
    rows: otobrannye,
    setQuery: sbrosit,
    matches,
    current,
    next: () => {
      setIndex((i) => (i + 1) % Math.max(matches.length, 1))
    },
    clear: () => {
      sbrosit('')
    },
    inputRef,
    focusInput: () => inputRef.current?.focus(),
  }
}
