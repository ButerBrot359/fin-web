import { useEffect } from 'react'
import type { NavigateFunction } from 'react-router-dom'

import {
  notifyTabDiscardClose,
  onTabSaveFailed,
  performTabClose,
  requestCloseAllTabs,
  useFormCacheStore,
  useTabCloseFlowStore,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'
import type { WorkspaceTab } from '@/features/workspace-tabs'

export interface TabCloseFlow {
  askedTab: WorkspaceTab | null
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function useTabCloseFlow(navigate: NavigateFunction): TabCloseFlow {
  const mode = useTabCloseFlowStore((s) => s.mode)
  const queue = useTabCloseFlowStore((s) => s.queue)
  const savingTabId = useTabCloseFlowStore((s) => s.savingTabId)
  const tabs = useWorkspaceTabsStore((s) => s.tabs)

  const headId = savingTabId ? null : (queue.at(0) ?? null)
  const askedTab = headId ? (tabs.find((t) => t.id === headId) ?? null) : null

  useEffect(() => {
    const flow = useTabCloseFlowStore.getState()
    if (!flow.mode) return
    const isOpen = (id: string) => tabs.some((t) => t.id === id)
    if (flow.savingTabId) {
      if (!isOpen(flow.savingTabId)) flow.advance()
      return
    }
    const head = flow.queue.at(0)
    if (head === undefined) {
      flow.cancel()
      if (flow.mode === 'all') requestCloseAllTabs(navigate)
      return
    }
    if (!isOpen(head)) flow.advance()
  }, [mode, queue, savingTabId, tabs, navigate])

  useEffect(
    () =>
      onTabSaveFailed((tabId) => {
        const flow = useTabCloseFlowStore.getState()
        if (flow.savingTabId === tabId) flow.cancel()
      }),
    []
  )

  const onSave = () => {
    if (!headId) return
    const flow = useTabCloseFlowStore.getState()
    useFormCacheStore.getState().setPendingAction(headId, 'save-and-close')
    if (flow.mode === 'all') flow.setSaving(headId)
    else flow.cancel()

    const store = useWorkspaceTabsStore.getState()
    if (headId === store.activeTabId) return
    const tab = store.tabs.find((t) => t.id === headId)
    if (!tab) return
    store.setActiveTab(tab.id)
    void navigate(tab.path + tab.search)
  }

  const onDiscard = () => {
    if (!headId) return
    const flow = useTabCloseFlowStore.getState()
    if (flow.mode === 'all') flow.advance()
    else flow.cancel()
    // «Не сохранять» — владелец формы (SDUI) должен снять серверный черновик
    // (CLOSE c discardDraft), иначе он всплывёт при следующем открытии (SCRUM-276)
    notifyTabDiscardClose(headId)
    performTabClose(headId, navigate)
  }

  const onCancel = () => {
    useTabCloseFlowStore.getState().cancel()
  }

  return { askedTab, onSave, onDiscard, onCancel }
}
