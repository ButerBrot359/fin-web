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
import { useDictSidebarStore } from '@/features/dict-sidebar/lib/hooks/use-dict-sidebar-store'
import type { SidebarPanelData } from '@/features/workspace-tabs'

export const WorkspaceTabSync = () => {
  const location = useLocation()
  const navType = useNavigationType()

  const activateOrCreate = useWorkspaceTabsStore((s) => s.activateOrCreate)
  const updateTabPath = useWorkspaceTabsStore((s) => s.updateTabPath)
  const addSidebarTab = useWorkspaceTabsStore((s) => s.addSidebarTab)
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

  // Dict sidebar sync
  const prevSidebarIdsRef = useRef<Set<string>>(new Set())

  const sidebarStack = useDictSidebarStore((s) => s.stack)

  useEffect(() => {
    const currentFormIds = new Set<string>()

    for (const panel of sidebarStack) {
      if (panel.mode === 'create' || panel.mode === 'edit') {
        currentFormIds.add(panel.id)

        if (!prevSidebarIdsRef.current.has(panel.id)) {
          const panelData: SidebarPanelData = {
            domain: panel.domain,
            typeCode: panel.typeCode,
            entryId: panel.entryId,
            mode: panel.mode,
            title: panel.title,
            searchParams: panel.searchParams,
            onSelect: panel.onSelect,
          }
          addSidebarTab(panel.id, panelData, panel.title ?? '')
        }
      }
    }

    prevSidebarIdsRef.current = currentFormIds
  }, [sidebarStack, addSidebarTab])

  return null
}
