import type { ViewEffect } from '../types/view'
import { usePanelStore, type PanelEntry } from './stores/panel-store'
import { openPanelTab } from './workspace-tab-gateway'

// Превращает openDialog-эффект в PanelEntry (и workspace-вкладку, если
// props.openInWorkspaceTab). Вынесено из dispatch.ts, чтобы session-less
// путь (движения из формы списка, open-movements.ts) шёл тем же кодом.
export function openDialogAsPanel(
  effect: ViewEffect,
  parentSessionId?: string,
  // id панелей, которые эта заменяет: сервер прислал их closeDialog в ОДНОМ
  // ответе с этим openDialog (пересборка того же окна под новый id). Тогда
  // закрытие и открытие идут одной транзакцией стора и без анимации —
  // см. panel-store.replace.
  closePanelIds?: string[]
): void {
  const props = effect.node?.props
  const presentationRaw = props?.presentation as string | undefined
  if (import.meta.env.DEV && !presentationRaw) {
    // A7: openDialog обязан нести presentation; отсутствие — баг бэк-композера.
    console.warn('[sdui] openDialog без presentation (A7)', effect.node?.id)
  }
  const presentation = presentationRaw ?? 'modal'
  const panelId = effect.node?.id ?? String(Date.now())
  const tabKey = props?.tabKey as string | undefined
  // page-панель с openInWorkspaceTab уходит в workspace-вкладку.
  // Если gateway не забинден — openPanelTab вернёт false и панель
  // откатится на прежний fullScreen Dialog.
  const inTab =
    props?.openInWorkspaceTab === true &&
    typeof tabKey === 'string' &&
    openPanelTab({
      tabKey,
      // props здесь уже сужен предыдущим условием цепочки — `?.` лишний
      // (eslint no-unnecessary-condition).
      title: (props.title as string | undefined) ?? '',
      panelId,
    })
  const entry: PanelEntry = {
    panelId,
    node: effect.node!,
    presentation: presentation as 'drawer' | 'modal' | 'page',
    viewState: effect.childState ?? {},
    hasChildState: effect.childState != null,
    ...(inTab ? { openInWorkspaceTab: true, tabKey } : {}),
  }
  if (effect.sessionId) {
    entry.session = {
      formSessionId: effect.sessionId,
      revision: effect.childRevision ?? 0,
      parentSessionId,
      targetNodeId: undefined,
    }
  }
  if (closePanelIds && closePanelIds.length > 0) {
    usePanelStore.getState().replace(closePanelIds, entry)
    return
  }
  // Повторное открытие того же документа (тот же tabKey → тот же node.id):
  // свежий PanelEntry с новым childState заменяет старый.
  if (inTab) usePanelStore.getState().remove(panelId)
  usePanelStore.getState().push(entry)
}
