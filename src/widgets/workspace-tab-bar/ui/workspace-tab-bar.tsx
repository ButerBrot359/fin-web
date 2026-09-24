import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  useWorkspaceTabsStore,
  useFormCacheStore,
  performTabClose,
  performCloseAllTabs,
  findDirtyTabIds,
  notifyTabDiscardClose,
} from '@/features/workspace-tabs'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { ConfirmDialog } from '@/shared/ui/confirm-dialog/confirm-dialog'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { WorkspaceTabItem } from './workspace-tab-item'

export const WorkspaceTabBar = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const tabs = useWorkspaceTabsStore((s) => s.tabs)
  const activeTabId = useWorkspaceTabsStore((s) => s.activeTabId)
  const setActiveTab = useWorkspaceTabsStore((s) => s.setActiveTab)

  const [dirtyCloseTabId, setDirtyCloseTabId] = useState<string | null>(null)
  const [dirtyCloseAllCount, setDirtyCloseAllCount] = useState(0)

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

    // «Не сохранять» — владелец формы (SDUI) должен снять серверный черновик
    // (CLOSE c discardDraft), иначе он всплывёт при следующем открытии (SCRUM-276)
    notifyTabDiscardClose(tabId)
    performClose(tabId)
  }

  const handleDialogCancel = () => {
    setDirtyCloseTabId(null)
  }

  const handleCloseAll = () => {
    const dirtyCount = findDirtyTabIds().length
    if (dirtyCount > 0) {
      setDirtyCloseAllCount(dirtyCount)
      return
    }
    performCloseAllTabs(navigate)
  }

  const handleCloseAllConfirm = () => {
    setDirtyCloseAllCount(0)
    performCloseAllTabs(navigate)
  }

  return (
    <>
      <div className="flex items-center gap-px pt-2">
        <div className="flex min-w-0 flex-1 gap-px overflow-x-auto">
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
        {tabs.length > 1 && (
          <button
            type="button"
            onClick={handleCloseAll}
            title={t('workspaceTabs.closeAll')}
            data-testid="workspace-tabs-close-all"
            className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-md border-none bg-ui-01 px-3 text-ui-06 transition-colors hover:text-accent-02"
          >
            <span className="whitespace-nowrap text-sm font-medium">
              {t('workspaceTabs.closeAll')}
            </span>
            <CrossIcon className="size-4 opacity-60" />
          </button>
        )}
      </div>

      <UnsavedChangesDialog
        open={dirtyCloseTabId !== null}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />

      <ConfirmDialog
        open={dirtyCloseAllCount > 0}
        title={t('workspaceTabs.closeAllDirtyTitle')}
        message={t('workspaceTabs.closeAllDirtyMessage', {
          count: dirtyCloseAllCount,
        })}
        confirmLabel={t('workspaceTabs.closeAllDirtyConfirm')}
        cancelLabel={t('actions.cancel')}
        onConfirm={handleCloseAllConfirm}
        onCancel={() => {
          setDirtyCloseAllCount(0)
        }}
      />
    </>
  )
}
