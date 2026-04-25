import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { useWorkspaceTabsStore } from './use-workspace-tabs-store'

export function useTabMeta(title: string, tabId?: string) {
  const { pathname } = useLocation()
  const setTabTitle = useWorkspaceTabsStore((s) => s.setTabTitle)

  // For router pages tab ID = pathname; for sidebar tabs explicit tabId is passed
  const resolvedId = tabId ?? pathname

  useEffect(() => {
    if (resolvedId && title) {
      setTabTitle(resolvedId, title)
    }
  }, [resolvedId, title, setTabTitle])
}
