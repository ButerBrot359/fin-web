import { useEffect, useRef } from 'react'
import {
  useLocation,
  useNavigationType,
  type NavigationType,
} from 'react-router-dom'

import {
  useWorkspaceTabsStore,
  resolvePageType,
  decideTabSync,
} from '@/features/workspace-tabs'

export const WorkspaceTabSync = () => {
  const location = useLocation()
  const navType = useNavigationType()

  const activateOrCreate = useWorkspaceTabsStore((s) => s.activateOrCreate)
  const updateTabPath = useWorkspaceTabsStore((s) => s.updateTabPath)
  const activeTabId = useWorkspaceTabsStore((s) => s.activeTabId)

  const prevPathRef = useRef(location.pathname)

  // Router location sync
  useEffect(() => {
    const { pathname, search } = location
    const pageType = resolvePageType(pathname)
    const REPLACE: NavigationType = 'REPLACE' as NavigationType

    // Флаг читаем из стора, а не через селектор: он взводится в том же тике,
    // что и navigate, и снапшот рендера может быть старее перехода.
    const { forceNewTab, consumeNewTab } = useWorkspaceTabsStore.getState()

    const action = decideTabSync({
      hasPageType: pageType !== null,
      isReplaceNavigation: navType === REPLACE,
      forceNewTab,
      activeTabId,
      prevPathname: prevPathRef.current,
      pathname,
    })

    if (action === 'updateActive' && activeTabId) {
      updateTabPath(activeTabId, pathname, search)
    } else if (action === 'create' && pageType) {
      activateOrCreate(pathname, search, pageType)
      // Гасим только когда флаг реально сработал: до целевого маршрута может
      // быть хоп через /documents/:type/new, у которого pageType ещё нет.
      if (forceNewTab) consumeNewTab()
    }

    prevPathRef.current = pathname
  }, [location.pathname, location.search]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
