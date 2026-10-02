import type { NavigateFunction } from 'react-router-dom'

import { useTabCloseFlowStore } from '../hooks/use-tab-close-flow-store'
import { findDirtyTabIds, performCloseAllTabs } from './perform-close-all-tabs'
import { performTabClose } from './perform-tab-close'
import { isTabDirty } from './is-tab-dirty'

export function requestTabClose(
  tabId: string,
  navigate: NavigateFunction
): void {
  if (isTabDirty(tabId)) {
    useTabCloseFlowStore.getState().start('single', [tabId])
    return
  }
  performTabClose(tabId, navigate)
}

export function requestCloseAllTabs(navigate: NavigateFunction): void {
  const dirty = findDirtyTabIds()
  if (dirty.length > 0) {
    useTabCloseFlowStore.getState().start('all', dirty)
    return
  }
  useTabCloseFlowStore.getState().cancel()
  performCloseAllTabs(navigate)
}
