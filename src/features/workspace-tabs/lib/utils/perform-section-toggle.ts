import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { runAfterTabLeaveFlush } from '../tab-leave-flush-registry'
import { requestTabClose } from './request-tab-close'

export function performSectionToggle(
  route: string,
  pathname: string,
  navigate: NavigateFunction
): void {
  if (route === '/' || pathname !== route) {
    runAfterTabLeaveFlush(() => {
      void navigate(route)
    })
    return
  }

  const { tabs, activeTabId } = useWorkspaceTabsStore.getState()
  const activeTab = tabs.find((t) => t.id === activeTabId)
  if (!activeTab) {
    void navigate('/')
    return
  }
  if (activeTab.pageType !== 'sdui-panel' && activeTab.path === route) {
    const tabId = activeTab.id
    runAfterTabLeaveFlush(() => {
      requestTabClose(tabId, navigate)
    })
    return
  }
  runAfterTabLeaveFlush(() => {
    void navigate(route)
  })
}
