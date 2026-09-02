import { useEffect } from 'react'

import {
  discardTabSession,
  setWorkspaceTabGateway,
  usePanelStore,
} from '@/features/sdui'
import {
  onPanelTabClose,
  onTabDiscardClose,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'

// Единственная точка связи SDUI ↔ workspace-tabs (app-слой знает обе зоны,
// сами фичи друг о друге — нет; образец — reference-picker gateway в App()).
// Прямая связь: SDUI просит открыть панельную вкладку → workspace-tabs.
// Обратная связь: вкладку закрыли крестиком → удалить панель из panel-store.
export function useWorkspaceTabGatewayBinding(): void {
  useEffect(() => {
    setWorkspaceTabGateway({
      openPanelTab: ({ tabKey, title, panelId }) => {
        useWorkspaceTabsStore
          .getState()
          .activateOrCreatePanel(tabKey, title, panelId)
      },
      armNewTab: () => {
        useWorkspaceTabsStore.getState().armNewTab()
      },
    })
    const unsubscribe = onPanelTabClose((panelId) => {
      usePanelStore.getState().remove(panelId)
    })
    // SCRUM-276 (черновики): «Не сохранять» на закрытии вкладки → CLOSE с
    // discardDraft (активная вкладка — интентом, кэшированная — транспортом).
    const unsubscribeDiscard = onTabDiscardClose(discardTabSession)
    return () => {
      setWorkspaceTabGateway(null)
      unsubscribe()
      unsubscribeDiscard()
    }
  }, [])
}
