import type { NavigateFunction } from 'react-router-dom'

import { notifyPanelTabClose } from '../panel-tab-close-registry'
import { notifyTabDiscardClose } from '../tab-discard-registry'
import { forgetFormInstanceId } from './form-instance-id'
import { useFormCacheStore } from '../hooks/use-form-cache-store'
import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'

export function findDirtyTabIds(): string[] {
  const { cache } = useFormCacheStore.getState()
  return useWorkspaceTabsStore
    .getState()
    .tabs.filter((t) => cache[t.id]?.isDirty === true)
    .map((t) => t.id)
}

export function performCloseAllTabs(navigate: NavigateFunction): void {
  const store = useWorkspaceTabsStore.getState()
  const tabs = [...store.tabs]
  if (tabs.length === 0) return

  const dirty = new Set(findDirtyTabIds())
  const formCache = useFormCacheStore.getState()

  for (const tab of tabs) {
    if (dirty.has(tab.id)) notifyTabDiscardClose(tab.id)
    const isPanel = tab.pageType === 'sdui-panel'
    if (!isPanel) formCache.removeTab(tab.id)
    forgetFormInstanceId(tab.path)
    const closed = useWorkspaceTabsStore.getState().closeTab(tab.id)
    if (isPanel && closed?.panelId) notifyPanelTabClose(closed.panelId)
  }

  void navigate('/')
}
