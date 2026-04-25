import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useWorkspaceTabsStore } from '@/features/workspace-tabs'
import type { WorkspaceTab } from '@/features/workspace-tabs'
import { useDictSidebarStore } from '@/features/dict-sidebar/lib/hooks/use-dict-sidebar-store'

import { UnsavedChangesDialog } from '@/shared/ui/unsaved-changes-dialog/unsaved-changes-dialog'

import { WorkspaceTabItem } from './workspace-tab-item'

const navigateAfterClose = (
  navigate: ReturnType<typeof useNavigate>,
  activeTabId: string | null
) => {
  const remaining = useWorkspaceTabsStore.getState()
  const nextTab = remaining.tabs.find((t) => !t.sidebarPanel)
  if (nextTab) {
    void navigate(nextTab.path + nextTab.search)
  } else if (activeTabId === null) {
    void navigate('/')
  }
}

export const WorkspaceTabBar = () => {
  const navigate = useNavigate()

  const tabs = useWorkspaceTabsStore((s) => s.tabs)
  const activeTabId = useWorkspaceTabsStore((s) => s.activeTabId)
  const closeTab = useWorkspaceTabsStore((s) => s.closeTab)
  const setActiveTab = useWorkspaceTabsStore((s) => s.setActiveTab)
  const pushSidebar = useDictSidebarStore((s) => s.push)

  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null)

  if (tabs.length === 0) return null

  const pushSidebarPanel = (tab: WorkspaceTab) => {
    if (!tab.sidebarPanel) return
    pushSidebar({
      mode: tab.sidebarPanel.mode,
      domain: tab.sidebarPanel.domain,
      typeCode: tab.sidebarPanel.typeCode,
      entryId: tab.sidebarPanel.entryId,
      title: tab.sidebarPanel.title,
      searchParams: tab.sidebarPanel.searchParams,
      onSelect: tab.sidebarPanel.onSelect,
    })
  }

  const handleActivate = (tab: WorkspaceTab) => {
    if (tab.id === activeTabId && !tab.sidebarPanel) return

    if (tab.sidebarPanel) {
      pushSidebarPanel(tab)
    } else {
      setActiveTab(tab.id)
      void navigate(tab.path + tab.search)
    }
  }

  const handleClose = (e: React.MouseEvent, tab: WorkspaceTab) => {
    e.stopPropagation()

    if (tab.isDirty) {
      setPendingCloseId(tab.id)
      return
    }

    const closed = closeTab(tab.id)
    if (closed?.id === activeTabId && !closed.sidebarPanel) {
      navigateAfterClose(navigate, useWorkspaceTabsStore.getState().activeTabId)
    }
  }

  const handleDiscardClose = () => {
    if (!pendingCloseId) return

    const wasActive = pendingCloseId === activeTabId
    const closedTab = closeTab(pendingCloseId)
    setPendingCloseId(null)

    if (wasActive && closedTab && !closedTab.sidebarPanel) {
      navigateAfterClose(navigate, useWorkspaceTabsStore.getState().activeTabId)
    }
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
              handleActivate(tab)
            }}
            onClose={(e) => {
              handleClose(e, tab)
            }}
          />
        ))}
      </div>

      <UnsavedChangesDialog
        open={pendingCloseId !== null}
        onSave={() => {
          const tab = tabs.find((t) => t.id === pendingCloseId)
          setPendingCloseId(null)
          if (tab && !tab.sidebarPanel) {
            setActiveTab(tab.id)
            void navigate(tab.path + tab.search)
          } else if (tab?.sidebarPanel) {
            pushSidebarPanel(tab)
          }
        }}
        onDiscard={handleDiscardClose}
        onCancel={() => {
          setPendingCloseId(null)
        }}
      />
    </>
  )
}
