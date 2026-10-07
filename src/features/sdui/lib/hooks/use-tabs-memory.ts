import { useCallback, useState } from 'react'

import { useSduiSession } from '../sdui-session-context'
import { useTabsMemoryStore } from '../stores/tabs-memory-store'

export const useRestoredActiveTab = (
  tabsNodeId: string
): string | undefined => {
  const { screenRoute } = useSduiSession()
  const [restored] = useState(() =>
    screenRoute
      ? useTabsMemoryStore.getState().get(screenRoute, tabsNodeId)
      : undefined
  )
  return restored
}

export const useRememberActiveTab = (
  tabsNodeId: string
): ((activeTabId: string) => void) => {
  const { screenRoute } = useSduiSession()
  return useCallback(
    (activeTabId: string) => {
      if (!screenRoute) return
      useTabsMemoryStore.getState().save(screenRoute, tabsNodeId, activeTabId)
    },
    [screenRoute, tabsNodeId]
  )
}
