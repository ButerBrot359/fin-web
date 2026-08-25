import type { ReactNode } from 'react'
import type {
  ColumnDef,
  VisibilityState,
  OnChangeFn,
  SortingState,
} from '@tanstack/react-table'

import type { ColumnMetaDto } from '@/shared/lib/eav'
import type { TableExportData } from '@/shared/lib/table-export'

/**
 * Кастомное поле в `ColumnDef.meta` — позволяет колонке tanstack/react-table
 * указать иной `code` для поиска `ColumnMetaDto` (например, у документов
 * визуальная колонка `status` соответствует системной мете `isPosted`).
 *
 * Если поле не задано — используется `column.id` как ключ.
 */
export interface EavColumnMetaExtra {
  metaCode?: string
}

export interface ListOutputColumn {
  id: string
  label: string
}

export interface EavEntityTableProps<T extends { id: number }> {
  /**
   * Namespace для table-filter стора. `undefined` ⇒ фильтрация отключена
   * (иконки в заголовках не рисуются, чипы скрыты).
   */
  filterTableId?: string

  /** Готовые колонки от вызывающей страницы. */
  columns: ColumnDef<T>[]

  /**
   * Метаданные колонок с бэка для рисовки иконок фильтра. `undefined` ⇒
   * иконки не рисуем (например, домен не в whitelist).
   */
  columnsMeta?: ColumnMetaDto[]

  entries: T[]
  totalElements: number
  isLoading: boolean
  isSortingOrFiltering: boolean
  isError?: boolean
  error?: unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void

  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>

  /** Controlled visible columns; omitted keeps the existing all-columns view. */
  columnVisibility?: VisibilityState
  onColumnVisibilityChange?: OnChangeFn<VisibilityState>

  selectedRowId?: number | null
  onRowClick?: (row: T) => void
  onRowDoubleClick?: (row: T) => void

  /**
   * Optional checkbox selection for list actions which genuinely support a
   * set of rows. It is opt-in so ordinary legacy lists keep their current
   * single-row behaviour.
   */
  multiRowSelection?: boolean
  selectedRowIds?: number[]
  onSelectedRowIdsChange?: (ids: number[]) => void

  /**
   * Имя для выгрузки в Excel (имя листа и файла). Если задано — в подвале
   * таблицы появляется кнопка «Выгрузить в Excel». `undefined` ⇒ кнопки нет.
   */
  exportFileName?: string

  /**
   * Загрузчик ВСЕХ строк (все страницы) для выгрузки. Если задан — в Excel
   * попадают все строки, а не только подгруженные в грид. Если не задан —
   * выгружаются текущие загруженные строки.
   */
  fetchAllEntries?: () => Promise<T[]>

  /**
   * Оверрайд подготовки данных для Excel. Получает строки для выгрузки (все,
   * если задан `fetchAllEntries`, иначе загруженные). Нужен страницам, где
   * отображаемые значения требуют доменного резолва (ID → имя), которого нет
   * в аксессорах (например, регистр бухгалтерии). Может быть асинхронным
   * (префетч ссылок). Если не задан — данные собираются из таблицы автоматически.
   */
  buildExportData?: (rows: T[]) => TableExportData | Promise<TableExportData>

  /**
   * Columns offered by the 1C-style "Output list" dialog. Omit this to keep
   * the table's existing direct Excel export only.
   */
  listOutputColumns?: ListOutputColumn[]
  listOutputOpen?: boolean
  onListOutputClose?: () => void
  listOutputSelectedRowsSupported?: boolean

  /**
   * Дополнительные строки перед виртуализированным телом (например,
   * ancestor-rows для иерархических справочников). Рендерятся как есть
   * внутри `<tbody>`, без виртуализации.
   */
  extraRowsAbove?: ReactNode
}
