import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { useWorkspaceTabsStore } from './use-workspace-tabs-store'

export function useTabMeta(title: string, tabId?: string) {
  const { pathname } = useLocation()
  const setTabTitle = useWorkspaceTabsStore((s) => s.setTabTitle)

  // Capture tab ID at mount time only — never changes on re-render
  const [resolvedId] = useState(() => tabId ?? pathname)

  useEffect(() => {
    if (resolvedId && title) {
      setTabTitle(resolvedId, title)
    }
  }, [resolvedId, title, setTabTitle])
}
