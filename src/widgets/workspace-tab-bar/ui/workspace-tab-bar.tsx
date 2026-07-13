import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  useWorkspaceTabsStore,
  useFormCacheStore,
  performTabClose,
} from '@/features/workspace-tabs'

import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { WorkspaceTabItem } from './workspace-tab-item'

export const WorkspaceTabBar = () => {
  const navigate = useNavigate()

  const tabs = useWorkspaceTabsStore((s) => s.tabs)
  const activeTabId = useWorkspaceTabsStore((s) => s.activeTabId)
  const setActiveTab = useWorkspaceTabsStore((s) => s.setActiveTab)

  const [dirtyCloseTabId, setDirtyCloseTabId] = useState<string | null>(null)

  if (tabs.length === 0) return null

  const handleActivate = (tabId: string) => {
    if (tabId === activeTabId) return
    const tab = tabs.find((t) => t.id === tabId)
    if (!tab) return
    setActiveTab(tab.id)
    // Панельная вкладка (sdui-panel) не привязана к роуту: контент рендерит
    // WorkspacePanelHost по activeTabId, навигация не нужна (и сломала бы URL).
    if (tab.pageType === 'sdui-panel') return
    void navigate(tab.path + tab.search)
  }

  const performClose = (tabId: string) => {
    performTabClose(tabId, navigate)
  }

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()

    const cacheEntry = useFormCacheStore.getState().cache[tabId]
    const isDirty = cacheEntry ? cacheEntry.isDirty : false
    if (isDirty) {
      setDirtyCloseTabId(tabId)
      return
    }

    performClose(tabId)
  }

  const handleDialogSave = () => {
    if (!dirtyCloseTabId) return
    const tabId = dirtyCloseTabId
    setDirtyCloseTabId(null)

    useFormCacheStore.getState().setPendingAction(tabId, 'save-and-close')

    if (tabId !== activeTabId) {
      const tab = tabs.find((t) => t.id === tabId)
      if (tab) {
        setActiveTab(tab.id)
        void navigate(tab.path + tab.search)
      }
    }
  }

  const handleDialogDiscard = () => {
    if (!dirtyCloseTabId) return
    const tabId = dirtyCloseTabId
    setDirtyCloseTabId(null)

    performClose(tabId)
  }

  const handleDialogCancel = () => {
    setDirtyCloseTabId(null)
  }

  return (
    <>
      <div className="flex gap-px overflow-x-auto pt-2">
        {tabs.map((tab) => (
          <WorkspaceTabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onActivate={() => {
              handleActivate(tab.id)
            }}
            onClose={(e) => {
              handleClose(e, tab.id)
            }}
          />
        ))}
      </div>

      <UnsavedChangesDialog
        open={dirtyCloseTabId !== null}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />
    </>
  )
}
