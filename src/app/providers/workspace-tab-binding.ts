import { useEffect } from 'react'

import { setWorkspaceTabGateway, usePanelStore } from '@/features/sdui'
import {
  onPanelTabClose,
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
    })
    const unsubscribe = onPanelTabClose((panelId) => {
      usePanelStore.getState().remove(panelId)
    })
    return () => {
      setWorkspaceTabGateway(null)
      unsubscribe()
    }
  }, [])
}
