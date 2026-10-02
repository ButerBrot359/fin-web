export { useWorkspaceTabsStore } from './lib/hooks/use-workspace-tabs-store'
export { MAX_TABS } from './lib/consts/workspace-tabs-config'
export { useFormCacheStore } from './lib/hooks/use-form-cache-store'
export { useFormCache } from './lib/hooks/use-form-cache'
export { useTabMeta } from './lib/hooks/use-tab-meta'
export { resolvePageType } from './lib/utils/resolve-page-type'
export { decideTabSync } from './lib/utils/decide-tab-sync'
export type { TabSyncAction, TabSyncInput } from './lib/utils/decide-tab-sync'
export { performTabClose } from './lib/utils/perform-tab-close'
export { performSectionToggle } from './lib/utils/perform-section-toggle'
export {
  performCloseAllTabs,
  findDirtyTabIds,
} from './lib/utils/perform-close-all-tabs'
export { performTabBack } from './lib/utils/perform-tab-back'
export {
  requestTabClose,
  requestCloseAllTabs,
} from './lib/utils/request-tab-close'
export { isTabDirty } from './lib/utils/is-tab-dirty'
export { useTabCloseFlowStore } from './lib/hooks/use-tab-close-flow-store'
export {
  setTabLeaveFlush,
  runAfterTabLeaveFlush,
} from './lib/tab-leave-flush-registry'
export type { TabLeaveFlush } from './lib/tab-leave-flush-registry'
export {
  onTabSaveFailed,
  notifyTabSaveFailed,
} from './lib/tab-save-failed-registry'
export {
  onPanelTabClose,
  notifyPanelTabClose,
} from './lib/panel-tab-close-registry'
export {
  onTabDiscardClose,
  notifyTabDiscardClose,
} from './lib/tab-discard-registry'
export type { WorkspaceTab, TabPageType } from './types/workspace-tab'
export {
  markFreshFormInstance,
  onFreshFormInstance,
} from './lib/fresh-form-instance-registry'
