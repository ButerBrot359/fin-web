import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { MAX_TABS } from '../consts/workspace-tabs-config'
import { dropFormInstanceId, moveFormInstanceId } from '../form-instance-ids'
import { tabEntityKey } from '../utils/tab-entity-key'
import type { WorkspaceTab, TabPageType } from '../../types/workspace-tab'

interface WorkspaceTabsStore {
  tabs: WorkspaceTab[]
  activeTabId: string | null
  // Одноразовый флаг «следующий маршрутный переход открывает НОВУЮ вкладку»
  // (эффект navigate с openInNewTab). Взводится до navigate, гасится
  // синхронизатором, когда переход дошёл до маршрута с известным pageType:
  // между ними может быть промежуточный редирект (/documents/:type/new →
  // /modules/:pageCode/document/:type/new), который иначе переписал бы путь
  // активной вкладки вместо создания новой.
  forceNewTab: boolean

  armNewTab: () => void
  consumeNewTab: () => void

  activateOrCreate: (
    path: string,
    search: string,
    pageType: TabPageType
  ) => string | null
  activateOrCreatePanel: (id: string, title: string, panelId: string) => void
  closeTab: (tabId: string) => WorkspaceTab | undefined
  setActiveTab: (tabId: string) => void
  setTabTitle: (tabId: string, title: string) => void
  updateTabPath: (tabId: string, path: string, search: string) => void
}

function updateTab(
  tabs: WorkspaceTab[],
  tabId: string,
  updater: (tab: WorkspaceTab) => WorkspaceTab
): WorkspaceTab[] {
  return tabs.map((t) => (t.id === tabId ? updater(t) : t))
}

export const useWorkspaceTabsStore = create<WorkspaceTabsStore>()(
  persist(
    (set, get) => ({
      tabs: [],
      activeTabId: null,
      forceNewTab: false,

      armNewTab: () => {
        set({ forceNewTab: true })
      },

      consumeNewTab: () => {
        set({ forceNewTab: false })
      },

      activateOrCreate: (path, search, pageType) => {
        if (path === '/') return null

        const { tabs } = get()

        // SCRUM-386 фикс 2: сущность может быть открыта под другим семейством
        // URL (модульный vs плоский) — вкладку с тем же сущностным ключом не
        // дублируем, а активируем. Вызывающая сторона по несовпадению id и
        // path редиректит URL на путь существующей вкладки.
        const key = tabEntityKey(path)
        const existing =
          tabs.find((t) => t.path === path) ??
          (key ? tabs.find((t) => tabEntityKey(t.path) === key) : undefined)
        if (existing) {
          set({
            activeTabId: existing.id,
            tabs: updateTab(tabs, existing.id, (t) =>
              t.path === path ? { ...t, search } : t
            ),
          })
          return existing.id
        }

        const id = path

        const tab: WorkspaceTab = {
          id,
          path,
          search,
          title: '',
          pageType,
          createdAt: Date.now(),
        }

        let newTabs = [...tabs, tab]
        if (newTabs.length > MAX_TABS) {
          // Вытесненная вкладка исчезает вместе со своим formInstanceId —
          // иначе следующее открытие того же маршрута подхватит её черновик
          dropFormInstanceId(newTabs[1].id)
          newTabs = [newTabs[0], ...newTabs.slice(2)]
        }

        set({ tabs: newTabs, activeTabId: id })
        return id
      },

      // Панельная вкладка (sdui-panel): не маршрутная, id = стабильный tabKey.
      // Повторный вызов с тем же id переиспользует вкладку (обновляя panelId).
      activateOrCreatePanel: (id, title, panelId) => {
        const { tabs, activeTabId } = get()

        const existing = tabs.find((t) => t.id === id)
        if (existing) {
          set({
            activeTabId: existing.id,
            tabs: updateTab(tabs, existing.id, (t) => ({
              ...t,
              title,
              panelId,
            })),
          })
          return
        }

        const tab: WorkspaceTab = {
          id,
          path: '',
          search: '',
          title,
          pageType: 'sdui-panel',
          panelId,
          // Опенер фиксируется при создании; исключена только самоссылка
          // (опенером может быть и другая панельная вкладка)
          openerTabId:
            activeTabId && activeTabId !== id ? activeTabId : undefined,
          createdAt: Date.now(),
        }

        let newTabs = [...tabs, tab]
        if (newTabs.length > MAX_TABS) {
          dropFormInstanceId(newTabs[1].id)
          newTabs = [newTabs[0], ...newTabs.slice(2)]
        }

        set({ tabs: newTabs, activeTabId: id })
      },

      closeTab: (tabId) => {
        const { tabs, activeTabId } = get()
        const idx = tabs.findIndex((t) => t.id === tabId)
        if (idx === -1) return undefined

        const closed = tabs[idx]
        // SCRUM-312: id вкладки умирает вместе с ней — новое открытие того же
        // маршрута получит новый formInstanceId (и пустую форму создания)
        dropFormInstanceId(tabId)
        const newTabs = tabs.filter((t) => t.id !== tabId)

        let newActiveId = activeTabId
        if (activeTabId === tabId) {
          const neighbor = newTabs.at(idx) ?? newTabs.at(idx - 1)
          newActiveId = neighbor ? neighbor.id : null
        }

        set({ tabs: newTabs, activeTabId: newActiveId })
        return closed
      },

      setActiveTab: (tabId) => {
        set({ activeTabId: tabId })
      },

      setTabTitle: (tabId, title) => {
        set((state) => ({
          tabs: updateTab(state.tabs, tabId, (t) => ({ ...t, title })),
        }))
      },

      updateTabPath: (tabId, path, search) => {
        // SCRUM-312: переход формы new → записанный меняет маршрут вкладки,
        // но это ТА ЖЕ вкладка — formInstanceId едет вместе с ней
        moveFormInstanceId(tabId, path)
        set((state) => ({
          tabs: updateTab(state.tabs, tabId, (t) => ({
            ...t,
            id: path,
            path,
            search,
          })),
          activeTabId: state.activeTabId === tabId ? path : state.activeTabId,
        }))
      },
    }),
    {
      name: 'workspace-tabs',
      storage: createJSONStorage(() => sessionStorage),
      // Панельные вкладки не персистим: их контент — in-memory panel-store SDUI,
      // перезагрузку не переживает (иначе после reload осиротевшая вкладка).
      partialize: (state) => {
        const tabs = state.tabs.filter((t) => t.pageType !== 'sdui-panel')
        return {
          tabs,
          activeTabId: tabs.some((t) => t.id === state.activeTabId)
            ? state.activeTabId
            : null,
        }
      },
    }
  )
)
