import { useMemo } from 'react'

import type { ViewNode } from '../../types/view'
import type { TableRow } from './use-table-sync'
import { useBindingValue } from '../sdui-session-context'
import { filterDetailRows, findSelectedMasterRow } from '../utils/master-detail'

/**
 * Отбор строк ТЧ по выбранной строке ВНЕШНЕГО списка — порт 1С `ОтборСтрок`
 * элемента формы («Начисление зарплаты сотрудникам»: панель со списком
 * сотрудников документа фильтрует сразу четырнадцать табличных частей).
 *
 * Объявляется тремя пропами TABLE-узла:
 * - `filterSource` — binding списка-источника;
 * - `filterSourceColumn` — колонка выбранной строки источника (ключ отбора);
 * - `filterColumn` — колонка ЭТОЙ таблицы, с которой ключ сравнивается.
 *
 * Ключи у разных ТЧ разные: «Начисления» и «Удержания» отбираются по
 * Сотруднику, налоговые части — по Физическому лицу (сотрудника в них нет),
 * ровно как в эталонной `ОтборСтрокТабЧастей`.
 *
 * <b>Почему не master-detail.</b> Тот же по смыслу механизм в проекте есть, но
 * он несёт побочные правила: без выбранной master-строки блокируется
 * «Добавить», гасится переупорядочивание, а новая строка получает ключ связи.
 * Для панели отбора это регресс — в эталоне пустой отбор означает «показать
 * всё», и таблица остаётся полностью рабочей.
 */
export function useExternalRowFilter(
  node: ViewNode,
  rows: TableRow[]
): TableRow[] {
  const source = node.props?.filterSource as string | undefined
  const sourceColumn = node.props?.filterSourceColumn as string | undefined
  const column = node.props?.filterColumn as string | undefined
  const active = Boolean(source && sourceColumn && column)

  const selectedRowId = useBindingValue(
    active && source ? source + '.__selectedRowId' : undefined
  ) as string | undefined
  const sourceRows = useBindingValue(active && source ? source : undefined) as
    | TableRow[]
    | undefined

  return useMemo(() => {
    if (!active || !sourceColumn || !column) return rows
    const selected = findSelectedMasterRow(sourceRows, selectedRowId)
    return filterDetailRows(rows, selected, sourceColumn, column)
  }, [active, rows, sourceRows, selectedRowId, sourceColumn, column])
}
