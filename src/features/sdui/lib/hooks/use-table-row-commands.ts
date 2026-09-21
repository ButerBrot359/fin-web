import type { KeyboardEvent } from 'react'

import { createTableHotkeysHandler } from '../utils/table-hotkeys'
import { omitServiceRowKeys } from '../utils/service-row-keys'
import type {
  TableColumnDef,
  TableRow,
  UseTableSyncResult,
} from './use-table-sync'
import type { TableSearchApi } from './use-table-search'

/**
 * Команды строк редактируемой ТЧ: добавить/копировать/удалить/переместить,
 * can*-флаги для тулбара и обработчик хоткеев (SCRUM-302). Общая механика
 * EditableTable и ComplexEditableTable; различия селекции параметризованы явно.
 */
export interface UseTableRowCommandsParams {
  sync: Pick<UseTableSyncResult, 'rows' | 'addRow' | 'deleteRow' | 'moveRow'>
  /**
   * Колонки СИНХРОНИЗАЦИИ — все, включая скрытые: на них держатся ключи
   * master-detail и служебные значения, они обязаны попадать в новую строку.
   */
  columns: TableColumnDef[]
  /** Видимый (отфильтрованный отбором/master-detail) набор строк. */
  visibleRows: TableRow[]
  /** rowId выбранной строки; null — выбора нет. */
  selectedRowId: string | null
  /**
   * rowId ВСЕХ выделенных строк (Ctrl/Shift, Ctrl+A) в порядке видимого набора. Пусто —
   * выделения нет и команда работает по текущей строке, как раньше.
   */
  selectedRowIds?: string[]
  /** Индекс выбранной строки в ВИДИМОМ наборе; -1 — выбора нет. */
  selectedVisibleIndex: number
  /**
   * «Добавить» — своя в каждой таблице: у complex это master-detail пресет +
   * автопереход SCRUM-363, у editable — голый addRow.
   */
  onAdd: () => void
  /** Снять выделение после удаления строки. */
  clearSelection: () => void
  /** Выделить строку по rowId — переход стрелками (поведение таблицы 1С). */
  selectRow?: (rowId: string) => void
  /** Выделить все видимые строки (Ctrl+A). */
  selectAll?: () => void
  /** Расширить выделение до строки с данным видимым индексом (Shift и стрелки). */
  extendSelection?: (visibleIndex: number) => void
  /**
   * Перевод ВИДИМОГО индекса в индекс полного массива для moveRow
   * (SCRUM-282 C1): editable считает его по rowId (отбор строк разрежает
   * набор), complex передаёт тождество — reorder там разрешён только вне
   * master-detail, где visibleRows === sync.rows.
   */
  globalIndexOf: (visibleIndex: number) => number
  /**
   * Сдвиг выделения вслед за перемещённой строкой. Нужен индексной селекции
   * (editable); rowId-селекция (complex) переезжает вместе со строкой сама —
   * параметр не передаётся.
   */
  onMoved?: (toVisibleIndex: number) => void
  search: Pick<TableSearchApi, 'focusInput' | 'clear'>
}

export interface UseTableRowCommandsResult {
  handleAdd: () => void
  handleCopy: () => void
  handleRemove: () => void
  handleMoveUp: () => void
  handleMoveDown: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  canRemove: boolean
  canCopy: boolean
  handleKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  /** Готовый проброс команд в TableToolbar (спред; частные флаги — поверх). */
  toolbarProps: {
    onAdd: () => void
    onCopy: () => void
    onRemove: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    canMoveUp: boolean
    canMoveDown: boolean
    canRemove: boolean
    canCopy: boolean
  }
}

export function useTableRowCommands({
  sync,
  columns,
  visibleRows,
  selectedRowId,
  selectedRowIds = [],
  selectedVisibleIndex,
  onAdd,
  clearSelection,
  selectRow,
  selectAll,
  extendSelection,
  globalIndexOf,
  onMoved,
  search,
}: UseTableRowCommandsParams): UseTableRowCommandsResult {
  const handleAdd = onAdd

  // Удаляем по rowId из ПОЛНОГО массива sync.rows (SCRUM-282 C1): видимый
  // индекс указывает на позицию в отфильтрованном visibleRows и не годится
  // для sync.deleteRow.
  const handleRemove = () => {
    const udalyaemye = udalyaemyeRowIds()
    if (udalyaemye.length === 0) return
    // По убыванию индекса: sync.deleteRow принимает позицию в полном массиве, и удаление
    // сверху вниз сдвигало бы позиции ещё не удалённых строк.
    const indeksy = udalyaemye
      .map((rowId) => sync.rows.findIndex((r) => r.rowId === rowId))
      .filter((index) => index >= 0)
      .sort((a, b) => b - a)
    indeksy.forEach((index) => {
      sync.deleteRow(index)
    })
    if (indeksy.length > 1) {
      // Выделенного диапазона больше нет — текущей строки в 1С после такого удаления тоже
      // нет, пока пользователь не выберет её сам.
      clearSelection()
      return
    }
    vydelitPosleUdaleniya()
  }

  /** Что удаляем: выделенный набор, а без него — текущую строку (прежнее поведение). */
  const udalyaemyeRowIds = (): string[] => {
    if (selectedRowIds.length > 0) return selectedRowIds
    return selectedRowId === null ? [] : [selectedRowId]
  }

  /**
   * Текущей становится строка, вставшая на место удалённой (последнюю сменяет предыдущая) —
   * так ведёт себя таблица 1С. Иначе после каждого удаления выделение пропадало и строку
   * приходилось выбирать мышью заново: удалить десяток позиций подряд было нечем
   * (обращение 20.09.2026 по доверенности).
   */
  const vydelitPosleUdaleniya = () => {
    const ostalos = visibleRows.length - 1
    if (selectedVisibleIndex < 0 || ostalos <= 0) {
      clearSelection()
      return
    }
    const indeks = Math.min(selectedVisibleIndex, ostalos - 1)
    if (onMoved !== undefined) {
      // Индексная селекция (editable): строка ниже сдвигается на место удалённой.
      onMoved(indeks)
      return
    }
    // Селекция по rowId (complex): берём соседа из ДОудалённого набора — строку ниже, а у
    // последней строки предыдущую (её индекс уже посчитан в indeks).
    const indeksSoseda =
      selectedVisibleIndex < ostalos ? selectedVisibleIndex + 1 : indeks
    selectRow?.(visibleRows[indeksSoseda].rowId)
  }

  // Копия строки: существующий addRow с пресетами из выбранной строки (без
  // rowId — buildEmptyRow сгенерирует новый tmp-id). Ссылочные ячейки
  // {id, presentation} копируются как есть, служебные ключи — нет: состояние
  // посчитано бэком для строки-источника и к копии не относится — без очистки
  // копия заблокированной строки приезжала бы заблокированной ещё до ответа
  // сервера (см. service-row-keys).
  const handleCopy = () => {
    if (selectedRowId === null) return
    const src = sync.rows.find((r) => r.rowId === selectedRowId)
    if (!src) return
    const { rowId: _rowId, ...values } = omitServiceRowKeys(src)
    sync.addRow(columns, values)
  }

  // Соседом считается соседняя ВИДИМАЯ строка: при активном отборе строки
  // между ними принадлежат другим сотрудникам, и перестановка через них
  // сдвинула бы чужие данные.
  const handleMoveUp = () => {
    if (selectedVisibleIndex <= 0) return
    const from = globalIndexOf(selectedVisibleIndex)
    const to = globalIndexOf(selectedVisibleIndex - 1)
    if (from < 0 || to < 0) return
    sync.moveRow(from, to)
    onMoved?.(selectedVisibleIndex - 1)
  }
  const handleMoveDown = () => {
    if (
      selectedVisibleIndex < 0 ||
      selectedVisibleIndex >= visibleRows.length - 1
    )
      return
    const from = globalIndexOf(selectedVisibleIndex)
    const to = globalIndexOf(selectedVisibleIndex + 1)
    if (from < 0 || to < 0) return
    sync.moveRow(from, to)
    onMoved?.(selectedVisibleIndex + 1)
  }

  // Стрелки водят по строкам: без выделения начинаем с первой (↓) или последней (↑) —
  // так же ведёт себя таблица 1С, когда текущей строки ещё нет.
  const perehod = (shag: -1 | 1, rasshirit = false) => {
    if (selectRow === undefined || visibleRows.length === 0) return
    const tekushchiy = selectedVisibleIndex
    const sleduyushchiy =
      tekushchiy < 0
        ? shag === 1
          ? 0
          : visibleRows.length - 1
        : Math.min(Math.max(tekushchiy + shag, 0), visibleRows.length - 1)
    selectRow(visibleRows[sleduyushchiy].rowId)
    if (rasshirit) extendSelection?.(sleduyushchiy)
  }

  const handleKeyDown = createTableHotkeysHandler({
    onAdd: handleAdd,
    onSelectPrev: () => {
      perehod(-1)
    },
    onSelectNext: () => {
      perehod(1)
    },
    onCopy: handleCopy,
    onRemove: handleRemove,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onFocusSearch: search.focusInput,
    onClearSearch: search.clear,
    onSelectAll: selectAll,
    onExtendPrev: () => {
      perehod(-1, true)
    },
    onExtendNext: () => {
      perehod(1, true)
    },
  })

  const canMoveUp = selectedVisibleIndex > 0
  const canMoveDown =
    selectedVisibleIndex >= 0 && selectedVisibleIndex < visibleRows.length - 1
  const canRemove = selectedRowId !== null || selectedRowIds.length > 0
  const canCopy = selectedRowId !== null

  return {
    handleAdd,
    handleCopy,
    handleRemove,
    handleMoveUp,
    handleMoveDown,
    canMoveUp,
    canMoveDown,
    canRemove,
    canCopy,
    handleKeyDown,
    toolbarProps: {
      onAdd: handleAdd,
      onCopy: handleCopy,
      onRemove: handleRemove,
      onMoveUp: handleMoveUp,
      onMoveDown: handleMoveDown,
      canMoveUp,
      canMoveDown,
      canRemove,
      canCopy,
    },
  }
}
