import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import {
  useWorkspaceTabsStore,
  requestTabClose,
  requestCloseAllTabs,
  runAfterTabLeaveFlush,
} from '@/features/workspace-tabs'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { useTabCloseFlow } from '../lib/hooks/use-tab-close-flow'
import { WorkspaceTabItem } from './workspace-tab-item'

export const WorkspaceTabBar = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const tabs = useWorkspaceTabsStore((s) => s.tabs)
  const activeTabId = useWorkspaceTabsStore((s) => s.activeTabId)
  const closeFlow = useTabCloseFlow(navigate)

  if (tabs.length === 0) return null

  const handleActivate = (tabId: string) => {
    if (tabId === activeTabId) return
    runAfterTabLeaveFlush(() => {
      const store = useWorkspaceTabsStore.getState()
      const tab = store.tabs.find((t) => t.id === tabId)
      if (!tab) return
      store.setActiveTab(tab.id)
      // Панельная вкладка (sdui-panel) не привязана к роуту: контент рендерит
      // WorkspacePanelHost по activeTabId, навигация не нужна (и сломала бы URL).
      if (tab.pageType === 'sdui-panel') return
      void navigate(tab.path + tab.search)
    })
  }

  const handleClose = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation()
    runAfterTabLeaveFlush(() => {
      requestTabClose(tabId, navigate)
    })
  }

  const handleCloseAll = () => {
    runAfterTabLeaveFlush(() => {
      requestCloseAllTabs(navigate)
    })
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
        open={closeFlow.askedTab !== null}
        message={
          closeFlow.askedTab?.title
            ? t('workspaceTabs.unsavedTabMessage', {
                title: closeFlow.askedTab.title,
              })
            : undefined
        }
        onSave={closeFlow.onSave}
        onDiscard={closeFlow.onDiscard}
        onCancel={closeFlow.onCancel}
      />
    </>
  )
}
