import { useEffect, useRef } from 'react'
import {
  useLocation,
  useNavigationType,
  type NavigationType,
} from 'react-router-dom'

import {
  useWorkspaceTabsStore,
  resolvePageType,
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

    if (!pageType) {
      prevPathRef.current = pathname
      return
    }

    const REPLACE: NavigationType = 'REPLACE' as NavigationType
    if (
      navType === REPLACE &&
      activeTabId &&
      prevPathRef.current !== pathname
    ) {
      updateTabPath(activeTabId, pathname, search)
    } else {
      activateOrCreate(pathname, search, pageType)
    }

    prevPathRef.current = pathname
  }, [location.pathname, location.search]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
