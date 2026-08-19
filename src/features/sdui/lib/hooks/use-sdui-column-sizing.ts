import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ColumnSizingState, OnChangeFn } from '@tanstack/react-table'

import type { ViewNode } from '../../types/view'
import { toRelativeColumnId } from '../utils/column-sizing'

/** Префикс ключа localStorage. Полный ключ — `sdui-col-widths:{columnStateKey}`. */
const STORAGE_PREFIX = 'sdui-col-widths:'

const EMPTY_SIZING: ColumnSizingState = {}

const storageKeyFor = (columnStateKey: string): string =>
  `${STORAGE_PREFIX}${columnStateKey}`

/**
 * Разбор сохранённой карты. Всё, что не положительное число, отбрасывается:
 * в localStorage может лежать мусор от старых версий или чужого кода, и он не
 * должен превращаться в NaN-ширины и ломать таблицу.
 */
function parseStored(raw: string | null): ColumnSizingState {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }
  const result: ColumnSizingState = {}
  for (const [key, value] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      result[key] = value
    }
  }
  return result
}

function readStored(columnStateKey: string): ColumnSizingState {
  try {
    return parseStored(localStorage.getItem(storageKeyFor(columnStateKey)))
  } catch {
    // localStorage недоступен (private mode) — работаем без персиста.
    return {}
  }
}

function writeStored(columnStateKey: string, sizing: ColumnSizingState): void {
  try {
    localStorage.setItem(storageKeyFor(columnStateKey), JSON.stringify(sizing))
  } catch {
    // localStorage недоступен (private mode) — ресайз остаётся в рамках сессии.
  }
}

/**
 * Id всех колоночных узлов таблицы (TABLE_COLUMN и COLUMN_GROUP на любом
 * уровне). Нужны, чтобы перевести карту персиста (относительные id) в состояние
 * TanStack (абсолютные id колонок) и обратно. Собираем надмножество: лишние id
 * просто не встречаются в состоянии таблицы.
 */
function collectColumnNodeIds(node: ViewNode): string[] {
  const ids: string[] = []
  const walk = (nodes: ViewNode[] | undefined): void => {
    for (const child of nodes ?? []) {
      const type = child.type as string
      if (type !== 'TABLE_COLUMN' && type !== 'COLUMN_GROUP') continue
      ids.push(child.id)
      walk(child.children)
    }
  }
  walk(node.children)
  return ids
}

/**
 * Карта персиста (относительные id) → состояние TanStack (абсолютные id колонок).
 * Ключи, которым не соответствует ни одна колонка дерева, отбрасываются.
 */
function toAbsolute(
  stored: ColumnSizingState,
  tableNodeId: string,
  columnIds: string[]
): ColumnSizingState {
  const result: ColumnSizingState = {}
  for (const columnId of columnIds) {
    const relativeId = toRelativeColumnId(tableNodeId, columnId)
    if (Object.hasOwn(stored, relativeId)) result[columnId] = stored[relativeId]
  }
  return result
}

export interface SduiColumnSizingResult {
  /** Мастер-выключатель: бэк прислал `columnsResizable` и непустой `columnStateKey`. */
  isResizable: boolean
  /** Для `useReactTable`: включает ресайз (и вместе с ним `column.getCanResize()`). */
  enableColumnResizing: boolean
  /** Для `useReactTable`: ширина едет за курсором, а не по отпусканию кнопки. */
  columnResizeMode: 'onChange'
  /** Для `useReactTable`: `state.columnSizing`, ключи — АБСОЛЮТНЫЕ id колонок. */
  columnSizing: ColumnSizingState
  /** Для `useReactTable`: `onColumnSizingChange`. */
  onColumnSizingChange: OnChangeFn<ColumnSizingState>
  /** Пользовательское отклонение по абсолютному id — для рендера без TanStack. */
  getColumnWidth: (columnId: string) => number | undefined
  /** Записать отклонение по абсолютному id — для рендера без TanStack. */
  setColumnWidth: (columnId: string, width: number) => void
}

/**
 * Ширины колонок одной SDUI-таблицы: контракт бэка + персист отклонений
 * пользователя в localStorage.
 *
 * <p>Читает с узла таблицы (TABLE/LIST) два props:
 * <ul>
 *   <li>`columnsResizable` — мастер-выключатель, эмитится только `true`;
 *       отсутствие = прежнее поведение без ресайза;</li>
 *   <li>`columnStateKey` — ключ персиста, приходит С БЭКА (фронт его не
 *       конструирует: один и тот же список/пикер должен помнить ширины под
 *       общим ключом независимо от того, из какого места формы он открыт).</li>
 * </ul>
 *
 * <p>Внутреннее состояние — это ровно то, что лежит в localStorage: карта
 * ОТНОСИТЕЛЬНЫХ id колонок (см. `toRelativeColumnId`). Состояние для TanStack
 * (`columnSizing`) выводится из неё по id колоночных узлов, а изменения от
 * TanStack переводятся обратно в относительные ключи. Ширины колонок, которых
 * сейчас нет в дереве, при этом сохраняются — сервер может показать их позже.
 */
export function useSduiColumnSizing(node: ViewNode): SduiColumnSizingResult {
  const columnsResizable = node.props?.columnsResizable === true
  const rawStateKey = node.props?.columnStateKey
  const columnStateKey = typeof rawStateKey === 'string' ? rawStateKey : ''
  const isResizable = columnsResizable && columnStateKey !== ''

  const nodeId = node.id
  const columnIds = useMemo(() => collectColumnNodeIds(node), [node])

  // Карта персиста: ключи — относительные id колонок.
  const [stored, setStored] = useState<ColumnSizingState>(() =>
    isResizable ? readStored(columnStateKey) : EMPTY_SIZING
  )

  // Зеркало состояния для обработчиков: onColumnSizingChange зовётся из
  // mousemove произвольного рендера, читать `stored` из замыкания там нельзя.
  const storedRef = useRef(stored)
  const columnIdsRef = useRef(columnIds)

  // Гидрация при монтировании и при СМЕНЕ ключа: один и тот же компонент
  // переиспользуется под разные таблицы (пикер справочника, вкладки карточки).
  useEffect(() => {
    const next = isResizable ? readStored(columnStateKey) : EMPTY_SIZING
    storedRef.current = next
    // eslint-disable-next-line react-hooks/set-state-in-effect -- гидрация из внешнего источника (localStorage), а не производная от пропсов
    setStored(next)
  }, [isResizable, columnStateKey])

  useEffect(() => {
    columnIdsRef.current = columnIds
  }, [columnIds])

  const columnSizing = useMemo(
    () => (isResizable ? toAbsolute(stored, nodeId, columnIds) : EMPTY_SIZING),
    [isResizable, columnIds, stored, nodeId]
  )

  /**
   * Единственная точка записи: и TanStack, и ручной drag приходят сюда с картой
   * АБСОЛЮТНЫХ id, а localStorage пишется синхронно с состоянием — persist в
   * useEffect дописывал бы карту при каждой гидрации.
   */
  const applyAbsolute = useCallback(
    (nextAbsolute: ColumnSizingState) => {
      if (!isResizable) return
      const columnIdsNow = columnIdsRef.current
      const known = new Set(
        columnIdsNow.map((columnId) => toRelativeColumnId(nodeId, columnId))
      )
      // Ширины колонок, которых сейчас нет в дереве, переносим как есть: под
      // одним columnStateKey (пикер, вкладки) состав колонок может отличаться.
      const next: ColumnSizingState = {}
      for (const [relativeId, width] of Object.entries(storedRef.current)) {
        if (!known.has(relativeId)) next[relativeId] = width
      }
      for (const columnId of columnIdsNow) {
        if (Object.hasOwn(nextAbsolute, columnId)) {
          next[toRelativeColumnId(nodeId, columnId)] = nextAbsolute[columnId]
        }
      }
      storedRef.current = next
      setStored(next)
      writeStored(columnStateKey, next)
    },
    [isResizable, columnStateKey, nodeId]
  )

  const onColumnSizingChange: OnChangeFn<ColumnSizingState> = useCallback(
    (updater) => {
      if (!isResizable) return
      const current = toAbsolute(
        storedRef.current,
        nodeId,
        columnIdsRef.current
      )
      applyAbsolute(typeof updater === 'function' ? updater(current) : updater)
    },
    [isResizable, nodeId, applyAbsolute]
  )

  const getColumnWidth = useCallback(
    (columnId: string): number | undefined => {
      if (!isResizable) return undefined
      const relativeId = toRelativeColumnId(nodeId, columnId)
      return Object.hasOwn(storedRef.current, relativeId)
        ? storedRef.current[relativeId]
        : undefined
    },
    [isResizable, nodeId]
  )

  const setColumnWidth = useCallback(
    (columnId: string, width: number) => {
      applyAbsolute({ ...columnSizing, [columnId]: width })
    },
    [applyAbsolute, columnSizing]
  )

  return {
    isResizable,
    enableColumnResizing: isResizable,
    columnResizeMode: 'onChange',
    columnSizing,
    onColumnSizingChange,
    getColumnWidth,
    setColumnWidth,
  }
}
