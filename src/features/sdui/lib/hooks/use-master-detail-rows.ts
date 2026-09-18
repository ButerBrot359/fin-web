import { useMemo } from 'react'

import type { ViewNode } from '../../types/view'
import { useBindingValue } from '../sdui-session-context'
import {
  findSelectedMasterRow,
  detailRowsWithoutMaster,
  filterDetailRows,
} from '../utils/master-detail'
import type {
  TableColumnDef,
  TableRow,
  UseTableSyncResult,
} from './use-table-sync'

export interface UseMasterDetailRowsResult {
  isMasterDetail: boolean
  /** Значение ключа связи выбранной master-строки; undefined — не выбрана. */
  masterKeyValue: unknown
  /** Строки ТЧ после master-detail фильтра (вне master-detail — исходные). */
  masterDetailRows: TableRow[]
  /** Добавление строки с учётом связи master-detail; null — добавить нельзя. */
  handleAdd: () => TableRow | null
}

/**
 * Master-detail связка двух ТЧ одного документа (график вычета ↔ master):
 * detail-таблица фильтруется по опубликованному выбору master-строки.
 */
export function useMasterDetailRows(
  node: ViewNode,
  rows: TableRow[],
  columns: TableColumnDef[],
  addRow: UseTableSyncResult['addRow']
): UseMasterDetailRowsResult {
  // Master-detail props
  const masterTable = node.props?.masterTable as string | undefined
  const masterKey = node.props?.masterKey as string | undefined
  const detailKey = node.props?.detailKey as string | undefined
  const isMasterDetail = Boolean(masterTable && masterKey && detailKey)

  // Реактивные подписки (SCRUM-282 #4): getValue давал разовый снимок,
  // detail не ре-рендерился при выборе master-строки.
  const selectedMasterRowId = useBindingValue(
    isMasterDetail && masterTable ? masterTable + '.__selectedRowId' : undefined
  ) as string | undefined
  const masterRows = useBindingValue(
    isMasterDetail && masterTable ? masterTable : undefined
  ) as TableRow[] | undefined

  const selectedMasterRow = findSelectedMasterRow(
    masterRows,
    selectedMasterRowId
  )
  const masterKeyValue =
    selectedMasterRow && masterKey ? selectedMasterRow[masterKey] : undefined

  // Отбор по внешнему списку (панель сотрудников) — независим от master-detail:
  // тот связывает ДВЕ ТЧ одного документа, этот фильтрует по витрине формы и не
  // трогает доступность команд таблицы.
  const masterDetailRows = useMemo<TableRow[]>(() => {
    if (!isMasterDetail || !masterKey || !detailKey) return rows
    // Строка master ещё не выбрана: эталон ставит отбор в ПУСТУЮ ссылку, то есть
    // показывает только строки без ключа связи. Без этой ветки detail показывал
    // строки ВСЕХ master-строк сразу (график вычета — по всем вычетам документа).
    if (!selectedMasterRow) {
      return detailRowsWithoutMaster(rows, detailKey)
    }
    return filterDetailRows(rows, selectedMasterRow, masterKey, detailKey)
  }, [rows, isMasterDetail, masterKey, detailKey, selectedMasterRow])

  // Detail-таблица: новая строка сразу получает ключ связи выбранной master-строки;
  // без выбранной master-строки добавление заблокировано (canAdd в тулбаре) — как
  // в 1С. Возвращает созданную строку (SCRUM-363: автофокусу нужен точный rowId).
  const handleAdd = (): TableRow | null => {
    if (isMasterDetail && detailKey) {
      if (masterKeyValue === undefined) return null
      return addRow(columns, { [detailKey]: masterKeyValue })
    }
    return addRow(columns)
  }

  return { isMasterDetail, masterKeyValue, masterDetailRows, handleAdd }
}
