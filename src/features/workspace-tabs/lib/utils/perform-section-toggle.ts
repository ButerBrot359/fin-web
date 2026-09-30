import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { performTabClose } from './perform-tab-close'

export function performSectionToggle(
  route: string,
  pathname: string,
  navigate: NavigateFunction
): void {
  if (route === '/' || pathname !== route) {
    void navigate(route)
    return
  }

  const { tabs, activeTabId } = useWorkspaceTabsStore.getState()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  if (!activeTab) {
    void navigate('/')
    return
  }
  if (activeTab.pageType !== 'sdui-panel' && activeTab.path === route) {
    performTabClose(activeTab.id, navigate)
    return
  }
  void navigate(route)
}
