import type { ViewEffect } from '../types/view'
import { usePanelStore, type PanelEntry } from './stores/panel-store'
import { openPanelTab } from './workspace-tab-gateway'

// Превращает openDialog-эффект в PanelEntry (и workspace-вкладку, если
// props.openInWorkspaceTab). Вынесено из dispatch.ts, чтобы session-less
// путь (движения из формы списка, open-movements.ts) шёл тем же кодом.
export function openDialogAsPanel(
  effect: ViewEffect,
  parentSessionId?: string,
): void {
  const props = effect.node?.props
  const presentation = (props?.presentation as string) ?? 'modal'
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
      title: (props?.title as string | undefined) ?? '',
      panelId,
    })
  const entry: PanelEntry = {
    panelId,
    node: effect.node!,
    presentation: presentation as 'drawer' | 'modal' | 'page',
    viewState: effect.childState ?? {},
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
  // Повторное открытие того же документа (тот же tabKey → тот же node.id):
  // свежий PanelEntry с новым childState заменяет старый.
  if (inTab) usePanelStore.getState().remove(panelId)
  usePanelStore.getState().push(entry)
}
