export { useWorkspaceTabsStore } from './lib/hooks/use-workspace-tabs-store'
export { useFormCacheStore } from './lib/hooks/use-form-cache-store'
export { useFormCache } from './lib/hooks/use-form-cache'
export { useTabMeta } from './lib/hooks/use-tab-meta'
export { resolvePageType } from './lib/utils/resolve-page-type'
export { decideTabSync } from './lib/utils/decide-tab-sync'
export type { TabSyncAction, TabSyncInput } from './lib/utils/decide-tab-sync'
export { performTabClose } from './lib/utils/perform-tab-close'
export { performTabBack } from './lib/utils/perform-tab-back'
export {
  onPanelTabClose,
  notifyPanelTabClose,
} from './lib/panel-tab-close-registry'
export {
  onTabDiscardClose,
  notifyTabDiscardClose,
} from './lib/tab-discard-registry'
export { ensureFormInstanceId } from './lib/form-instance-ids'
export type { WorkspaceTab, TabPageType } from './types/workspace-tab'
