export type TabSyncAction = 'skip' | 'create' | 'updateActive'

export interface TabSyncInput {
  // null — маршрут вне рабочих вкладок (resolvePageType не распознал)
  hasPageType: boolean
  isReplaceNavigation: boolean
  forceNewTab: boolean
  activeTabId: string | null
  prevPathname: string
  pathname: string
}

/**
 * Что делать со вкладками на смену маршрута.
 *
 * `updateActive` — редирект внутри той же вкладки (`/documents/:type/new` →
 * `/modules/:pageCode/document/:type/new`, resolve id после записи): путь активной
 * вкладки переписывается, новой не появляется.
 *
 * `create` — обычный переход и любой переход со взведённым `forceNewTab`
 * (эффект `navigate` с `openInNewTab`): вкладка-источник остаётся, новая
 * становится активной. Флаг обязан перебивать ветку REPLACE — иначе промежуточный
 * редирект превратит вкладку-источник в приёмник, и «Создать на основании»
 * съест вкладку документа-основания.
 */
export function decideTabSync(input: TabSyncInput): TabSyncAction {
  if (!input.hasPageType) return 'skip'
  if (input.forceNewTab) return 'create'
  if (
    input.isReplaceNavigation &&
    input.activeTabId &&
    input.prevPathname !== input.pathname
  ) {
    return 'updateActive'
  }
  return 'create'
}
