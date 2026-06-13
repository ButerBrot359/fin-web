import { createElement, Fragment, type ReactNode } from 'react'
import { flexRender, type Table } from '@tanstack/react-table'

import type { XlsxCell } from '@/shared/lib/xlsx/write-xlsx'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'

/**
 * Данные одного листа Excel: заголовки + матрица значений.
 */
export interface TableExportData {
  headers: string[]
  rows: XlsxCell[][]
}

/**
 * Поля в `ColumnDef.meta`, управляющие экспортом колонки в Excel.
 *
 * По умолчанию (без этих полей) экспортируются все колонки, у которых есть
 * `accessorFn`/`accessorKey`; значение берётся «как есть» из аксессора.
 */
export interface TableExportColumnMeta {
  /** Исключить колонку из выгрузки (например, колонка со значком статуса). */
  exportExclude?: boolean
  /** Явный текст заголовка (если заголовок — JSX и плохо извлекается). */
  exportHeader?: string
}

const htmlToText = (html: string): string =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim()

/**
 * Извлекает текст заголовка колонки. Заголовки в проекте — это JSX
 * (`() => <span>{t(...)}</span>`), поэтому рендерим их в статическую разметку
 * и снимаем теги. `renderToStaticMarkup` подгружается динамически, чтобы не
 * тянуть `react-dom/server` в основной бандл.
 */
const extractHeaderText = async (node: ReactNode): Promise<string> => {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  try {
    const { renderToStaticMarkup } = await import('react-dom/server')
    return htmlToText(renderToStaticMarkup(createElement(Fragment, null, node)))
  } catch {
    return ''
  }
}

// ISO-дата (`2026-06-11` или `2026-06-11T11:40:55`) — частый формат значений
// аксессоров; приводим к виду грида, иначе в Excel попадёт «сырой» ISO.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/

const toCell = (value: unknown): XlsxCell => {
  if (value == null || value === '') return ''
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'string') {
    if (ISO_DATE_RE.test(value)) {
      return value.length > 10 ? formatDateTime(value) : formatDate(value)
    }
    return value
  }
  // Объекты/массивы в Excel не выводим — они требуют доменного резолва на
  // стороне страницы (см. `buildExportData`-оверрайд).
  return ''
}

/**
 * Собирает данные для Excel из инстанса таблицы TanStack: заголовки видимых
 * колонок + значения аксессоров.
 *
 * `data` — полный набор строк для выгрузки (все страницы). Если не передан,
 * берутся строки, уже загруженные в грид.
 *
 * Колонки без аксессора (например, колонка-иконка) и помеченные
 * `meta.exportExclude` пропускаются.
 */
export const extractTableExport = async <T>(
  table: Table<T>,
  data?: T[]
): Promise<TableExportData> => {
  const leafHeaders = table.getHeaderGroups().at(-1)?.headers ?? []

  const exported = leafHeaders.filter((header) => {
    const meta = header.column.columnDef.meta as TableExportColumnMeta | undefined
    if (meta?.exportExclude) return false
    // Без аксессора колонка не несёт данных (чисто визуальная) — пропускаем.
    return header.column.accessorFn != null
  })

  const headers = await Promise.all(
    exported.map(async (header) => {
      const meta = header.column.columnDef.meta as
        | TableExportColumnMeta
        | undefined
      if (meta?.exportHeader) return meta.exportHeader
      if (header.isPlaceholder) return ''
      const text = await extractHeaderText(
        flexRender(header.column.columnDef.header, header.getContext())
      )
      return text || header.column.id
    })
  )

  const rows = data
    ? // Полный набор: прогоняем «сырые» строки через аксессоры колонок.
      data.map((row, index) =>
        exported.map((header) =>
          toCell(header.column.accessorFn?.(row, index))
        )
      )
    : // Фолбэк: только загруженные в грид строки.
      table
        .getCoreRowModel()
        .rows.map((row) =>
          exported.map((header) => toCell(row.getValue(header.column.id)))
        )

  return { headers, rows }
}
