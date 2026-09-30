import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'

import type { TableCommandDescriptor, ViewNode } from '../../types/view'
import { useSduiDispatch } from '../dispatch'
import { readOnlyRowId } from '../utils/read-only-row-id'
import {
  buildTableCommandAction,
  defaultRowCommand,
} from '../utils/table-command-action'
import { createTableHotkeysHandler } from '../utils/table-hotkeys'
import { useTableSearch, type TableSearchApi } from './use-table-search'
import type { TableRow } from './use-table-sync'

/** Выбор одной строки таблицы — пропсы строки ReadOnlyTableRow. */
export interface ReadOnlyRowSelection {
  rowId: string
  selected: boolean
  onSelect: () => void
  /** Двойной клик — команда строки по умолчанию («Открыть»). */
  onActivate: () => void
}

export interface ReadOnlyRowCommands {
  /** У таблицы есть props.tableCommands — панель и выбор строки включены. */
  enabled: boolean
  commands: TableCommandDescriptor[]
  selectedRowId: string | null
  search: TableSearchApi
  selectRow: (rowId: string) => void
  /** Двойной клик / Enter: единственная строковая команда, если она есть. */
  activateRow: (rowId: string) => void
  handleKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  /**
   * Пропсы выбора для строки; undefined — таблица без команд (строка пассивна,
   * как прежде) или у строки нет идентичности.
   */
  rowSelection: (
    row: Record<string, unknown>
  ) => ReadOnlyRowSelection | undefined
}

/** Команды панели TABLE-узла; не массив — команд нет. */
export function readTableCommands(node: ViewNode): TableCommandDescriptor[] {
  const raw = node.props?.tableCommands
  return Array.isArray(raw) ? (raw as TableCommandDescriptor[]) : []
}

// Свой фокус (кнопки панели, пункты меню, поле поиска): Enter там — их дело.
const SVOY_ENTER = 'button, input, textarea, select, a, [role="menuitem"]'

const noop = () => undefined

/**
 * Выбор строки и команды панели для read-only таблицы (push-модель: строки в
 * state по binding). Тот же способ отправки, что у TableToolbar редактируемых
 * ТЧ (buildTableCommandAction), та же раскладка клавиш (table-hotkeys): ↑/↓ —
 * по строкам, Ctrl+F / Ctrl+Q — поиск, Enter — команда строки по умолчанию.
 */
export function useReadOnlyRowCommands(
  node: ViewNode,
  rows: Record<string, unknown>[],
  columns: { id: string; binding?: string }[],
  scrollToRow: (index: number) => void
): ReadOnlyRowCommands {
  const dispatch = useSduiDispatch()
  const commands = readTableCommands(node)
  const rowIds = useMemo(() => rows.map(readOnlyRowId), [rows])

  // Поиск — по строкам с идентичностью: совпадение адресуется rowId.
  const searchRows = useMemo<TableRow[]>(
    () =>
      rows.flatMap((row, i) => {
        const rowId = rowIds[i]
        return rowId === null ? [] : [{ ...row, rowId }]
      }),
    [rows, rowIds]
  )
  const searchColumns = columns.flatMap((c) =>
    c.binding === undefined ? [] : [{ id: c.id, binding: c.binding }]
  )
  const search = useTableSearch(searchRows, searchColumns)

  const [chosen, setChosen] = useState<string | null>(null)
  // Текущее совпадение поиска делает строку текущей — производное состояние
  // рендера (без эффекта): смена совпадения переносит выбор на его строку.
  const hitRowId = search.current?.rowId ?? null
  const [seenHit, setSeenHit] = useState<string | null>(null)
  if (hitRowId !== seenHit) {
    setSeenHit(hitRowId)
    if (hitRowId !== null) setChosen(hitRowId)
  }
  // Строка исчезла после серверного обновления — выбора больше нет.
  const selectedRowId =
    chosen !== null && rowIds.includes(chosen) ? chosen : null

  // Совпадение вне окна виртуализации: довести его до кадра.
  const hitIndex = hitRowId === null ? -1 : rowIds.indexOf(hitRowId)
  useEffect(() => {
    if (hitIndex >= 0) scrollToRow(hitIndex)
    // scrollToRow пересоздаётся хуком виртуализации на каждый рендер
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitIndex])

  const activateRow = (rowId: string) => {
    const cmd = defaultRowCommand(commands)
    if (!cmd) return
    setChosen(rowId)
    void dispatch(buildTableCommandAction(cmd, rowId), cmd.behavior)
  }

  const move = (shag: -1 | 1) => {
    const selectable = rowIds.flatMap((id, index) =>
      id === null ? [] : [{ id, index }]
    )
    if (selectable.length === 0) return
    const current = selectable.findIndex((r) => r.id === selectedRowId)
    const next =
      current < 0
        ? shag === 1
          ? 0
          : selectable.length - 1
        : Math.min(Math.max(current + shag, 0), selectable.length - 1)
    setChosen(selectable[next].id)
    scrollToRow(selectable[next].index)
  }

  const hotkeys = createTableHotkeysHandler({
    onAdd: noop,
    onCopy: noop,
    onRemove: noop,
    onMoveUp: noop,
    onMoveDown: noop,
    onSelectPrev: () => {
      move(-1)
    },
    onSelectNext: () => {
      move(1)
    },
    onFocusSearch: search.focusInput,
    onClearSearch: search.clear,
  })

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const plainEnter =
      e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey
    if (plainEnter) {
      const target = e.target
      if (target instanceof Element && target.closest(SVOY_ENTER)) return
      if (selectedRowId !== null) {
        e.preventDefault()
        activateRow(selectedRowId)
      }
      return
    }
    hotkeys(e)
  }

  const enabled = commands.length > 0
  const rowSelection = (
    row: Record<string, unknown>
  ): ReadOnlyRowSelection | undefined => {
    if (!enabled) return undefined
    const rowId = readOnlyRowId(row)
    if (rowId === null) return undefined
    return {
      rowId,
      selected: rowId === selectedRowId,
      onSelect: () => {
        setChosen(rowId)
      },
      onActivate: () => {
        activateRow(rowId)
      },
    }
  }

  return {
    enabled,
    commands,
    selectedRowId,
    search,
    selectRow: setChosen,
    activateRow,
    handleKeyDown,
    rowSelection,
  }
}
