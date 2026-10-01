import type { ClipboardEvent, KeyboardEvent } from 'react'

import {
  createTableHotkeysHandler,
  isEditableTarget,
} from '../utils/table-hotkeys'
import { omitServiceRowKeys } from '../utils/service-row-keys'
import { isColumnVisible } from '../utils/column-visibility'
import {
  razobratTsv,
  stroitTsv,
  vzyatKopiyu,
  zapomnitKopiyu,
  type ClipboardRowValues,
} from '../utils/table-clipboard'
import { buildEmptyRow } from './table-sync-model'
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
  sync: Pick<
    UseTableSyncResult,
    'rows' | 'addRow' | 'deleteRow' | 'moveRow' | 'replaceRows' | 'undo'
  >
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
  moveCurrentRow?: (rowId: string) => void
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
  /**
   * Ctrl+S — записать форму (`useFormSaveCommand`). Передают таблицы; в тестах
   * хука не нужен, поэтому опционален.
   */
  onSave?: () => void
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
  /** Ctrl+C — выделенные строки в буфер обмена (TSV + свой буфер значений). */
  handleCopyToClipboard: () => void
  /** Ctrl+Z — отмена последнего действия над строками. */
  handleUndo: () => void
  handleKeyDown: (e: KeyboardEvent<HTMLElement>) => void
  /**
   * Ctrl+V — обработчик события `paste` контейнера таблицы. Событие, а не
   * хоткей: `clipboardData` доступен синхронно и без разрешения на чтение буфера.
   */
  handlePasteEvent: (e: ClipboardEvent<HTMLElement>) => void
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
  moveCurrentRow,
  globalIndexOf,
  onMoved,
  search,
  onSave,
}: UseTableRowCommandsParams): UseTableRowCommandsResult {
  const handleAdd = onAdd

  // Удаляем по rowId из ПОЛНОГО массива sync.rows (SCRUM-282 C1): видимый
  // индекс указывает на позицию в отфильтрованном visibleRows и не годится
  // для sync.deleteRow.
  const handleRemove = () => {
    const udalyaemye = udalyaemyeRowIds()
    if (udalyaemye.length === 0) return
    const nabor = new Set(udalyaemye)
    const ostayutsya = sync.rows.filter((r) => !nabor.has(r.rowId))
    const skolkoUdalyaem = sync.rows.length - ostayutsya.length
    if (skolkoUdalyaem === 0) return
    if (skolkoUdalyaem > 1) {
      sync.replaceRows(ostayutsya)
      // Выделенного диапазона больше нет — текущей строки в 1С после такого удаления тоже
      // нет, пока пользователь не выберет её сам.
      clearSelection()
      return
    }
    sync.deleteRow(sync.rows.findIndex((r) => nabor.has(r.rowId)))
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
    const rowId = visibleRows[sleduyushchiy].rowId
    if (rasshirit) {
      moveCurrentRow?.(rowId)
      extendSelection?.(sleduyushchiy)
      return
    }
    selectRow(rowId)
  }

  /** Строки под операцию буфера: выделенный набор, а без него — текущая. */
  const kopiruemyeStroki = (): TableRow[] => {
    const rowIds = udalyaemyeRowIds()
    return rowIds
      .map((rowId) => sync.rows.find((r) => r.rowId === rowId))
      .filter((row): row is TableRow => row !== undefined)
  }

  /**
   * Ctrl+C: в системный буфер уходит TSV по ВИДИМЫМ колонкам (его читает Excel),
   * а рядом остаётся свой буфер с полными значениями строк — по нему вставка
   * внутри приложения восстанавливает ссылки и скрытые колонки, которых в
   * тексте нет. Текст пишем через navigator.clipboard: событие `copy` браузер
   * при пустом текстовом выделении не гарантирует.
   */
  const handleCopyToClipboard = () => {
    const stroki = kopiruemyeStroki()
    if (stroki.length === 0) return
    const tekst = stroitTsv(stroki, columns.filter(isColumnVisible))
    zapomnitKopiyu(tekst, stroki)
    // Системного буфера может не быть вовсе (не https, старый браузер) — тип
    // обещает его безусловно, поэтому отказ ловим, а не проверяем. Вставка
    // внутри приложения работает и без него: она идёт из своего буфера.
    try {
      void navigator.clipboard.writeText(tekst).catch(() => undefined)
    } catch {
      // Буфер недоступен — ограничиваемся своим.
    }
  }

  /** Ctrl+V: строки из буфера дописываются в конец ТЧ — как «Вставить» в 1С. */
  const vstavit = (znacheniya: ClipboardRowValues[]) => {
    if (znacheniya.length === 0) return
    const novye = znacheniya.map((values) => ({
      ...buildEmptyRow(columns),
      ...values,
    }))
    sync.replaceRows([...sync.rows, ...novye])
  }

  const handlePasteEvent = (e: ClipboardEvent<HTMLElement>) => {
    // В ячейке Ctrl+V обязан остаться вставкой текста в инпут.
    if (isEditableTarget(e.target)) return
    const tekst = e.clipboardData.getData('text/plain')
    if (tekst.trim() === '') return
    e.preventDefault()
    vstavit(
      vzyatKopiyu(tekst) ?? razobratTsv(tekst, columns.filter(isColumnVisible))
    )
  }

  const handleUndo = () => {
    sync.undo()
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
    onCopyToClipboard: handleCopyToClipboard,
    onUndo: handleUndo,
    onSave: onSave,
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
    handleCopyToClipboard,
    handleUndo,
    handleKeyDown,
    handlePasteEvent,
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
