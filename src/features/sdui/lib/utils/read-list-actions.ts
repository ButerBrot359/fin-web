import type { ViewNode, ViewNodeAction } from '../../types/view'

export interface ListActions {
  selectAction: ViewNodeAction | undefined
  activateAction: ViewNodeAction | undefined
  sortCommand: string | undefined
  filterCommand: string | undefined
  clearFilterCommand: string | undefined
  clearAllFiltersCommand: string | undefined
  periodCommand: string | undefined
  exportCommand: string | undefined
  // SCRUM-360 v6 §8: раскрытие узла дерева (displayMode=TREE) — действие
  // целиком: команде list.toggleExpand нужен и behavior (flush:false и т.д.).
  expandAction: ViewNodeAction | undefined
}

/**
 * Действия LIST-узла одним чтением.
 *
 * SCRUM-362 B-1: команды приезжают готовыми в node.actions, строка command
 * непрозрачна — фронт больше не собирает их по шаблону и не выкусывает
 * {TypeCode}. Набор actions — сигнал capability: sort/filter/clearFilter/
 * clearAllFilters/period сервер шлёт только на транспорте SEARCH, поэтому
 * контролы гейтятся наличием action (на PAGED их нет — это корректно).
 *
 * export — кнопка «Выгрузить в Excel» в подвале: команда приходит готовой
 * (list.exportList:all — прямая серверная выгрузка без диалога колонок).
 * Нет действия — нет кнопки.
 */
export const readListActions = (node: ViewNode): ListActions => {
  const find = (trigger: string): ViewNodeAction | undefined =>
    node.actions?.find((a) => a.trigger === trigger)
  return {
    selectAction: find('select'),
    activateAction: find('activate'),
    sortCommand: find('sort')?.command,
    filterCommand: find('filter')?.command,
    clearFilterCommand: find('clearFilter')?.command,
    clearAllFiltersCommand: find('clearAllFilters')?.command,
    periodCommand: find('period')?.command,
    exportCommand: find('export')?.command,
    expandAction: find('expand'),
  }
}
