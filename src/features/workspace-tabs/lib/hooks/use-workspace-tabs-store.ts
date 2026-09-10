import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import { MAX_TABS } from '../consts/workspace-tabs-config'
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
  /**
   * Журнал активаций, свежие впереди. Нужен закрытию вкладки: уходить надо на ту, откуда
   * пришли, а не на случайного соседа по позиции (см. closeTab).
   */
  activationOrder: string[]

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

/** Отмечает вкладку как активированную: свежие впереди, без дублей. */
function remember(order: string[], tabId: string): string[] {
  return [tabId, ...order.filter((id) => id !== tabId)]
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
      activationOrder: [],

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
            activationOrder: remember(get().activationOrder, existing.id),
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
          // Опенер — вкладка, из которой открыли эту (журнал → карточка). Раньше он
          // проставлялся только панельным вкладкам, и закрытие маршрутной уводило на
          // соседа по позиции: из журнала зарплаты выбрасывало в журнал больничных
          // (разбор по логам 09.09.2026).
          openerTabId:
            get().activeTabId && get().activeTabId !== id
              ? (get().activeTabId ?? undefined)
              : undefined,
          createdAt: Date.now(),
        }

        let newTabs = [...tabs, tab]
        if (newTabs.length > MAX_TABS) {
          newTabs = [newTabs[0], ...newTabs.slice(2)]
        }

        set({
          tabs: newTabs,
          activeTabId: id,
          activationOrder: remember(get().activationOrder, id),
        })
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
            activationOrder: remember(get().activationOrder, existing.id),
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
          newTabs = [newTabs[0], ...newTabs.slice(2)]
        }

        set({
          tabs: newTabs,
          activeTabId: id,
          activationOrder: remember(get().activationOrder, id),
        })
      },

      /**
       * Закрытие вкладки. Куда уходим, если закрыли АКТИВНУЮ:
       *   1) вкладка-опенер — та, из которой эту открыли (журнал → карточка → назад в журнал);
       *   2) иначе последняя активная из журнала активаций — как «предыдущее окно» 1С;
       *   3) иначе сосед по позиции — прежнее поведение, когда истории нет (после F5).
       *
       * <p>Раньше был только шаг 3, и закрытие журнала выбрасывало на соседнюю вкладку:
       * из «Начисления зарплаты» — в «Больничный лист», просто потому что тот стоял рядом
       * в баре (разбор по логам 09.09.2026).
       */
      closeTab: (tabId) => {
        const { tabs, activeTabId, activationOrder } = get()
        const idx = tabs.findIndex((t) => t.id === tabId)
        if (idx === -1) return undefined

        const closed = tabs[idx]
        const newTabs = tabs.filter((t) => t.id !== tabId)
        const newOrder = activationOrder.filter((id) => id !== tabId)

        let newActiveId = activeTabId
        if (activeTabId === tabId) {
          const alive = (id: string | undefined | null) =>
            id != null && newTabs.some((t) => t.id === id)
          const opener = alive(closed.openerTabId)
            ? closed.openerTabId
            : undefined
          const lastActive = newOrder.find(alive)
          const neighbor = newTabs.at(idx) ?? newTabs.at(idx - 1)
          newActiveId = opener ?? lastActive ?? neighbor?.id ?? null
        }

        set({
          tabs: newTabs,
          activeTabId: newActiveId,
          activationOrder: newOrder,
        })
        return closed
      },

      setActiveTab: (tabId) => {
        set({
          activeTabId: tabId,
          activationOrder: remember(get().activationOrder, tabId),
        })
      },

      setTabTitle: (tabId, title) => {
        set((state) => ({
          tabs: updateTab(state.tabs, tabId, (t) => ({ ...t, title })),
        }))
      },

      updateTabPath: (tabId, path, search) => {
        set((state) => ({
          tabs: updateTab(state.tabs, tabId, (t) => ({
            ...t,
            id: path,
            path,
            search,
          })),
          activeTabId: state.activeTabId === tabId ? path : state.activeTabId,
          // Идентификатор вкладки — это её путь, и он здесь меняется: журнал активаций и
          // ссылки-опенеры обязаны переехать на новый id, иначе закрытие уводит в никуда.
          activationOrder: state.activationOrder.map((id) =>
            id === tabId ? path : id
          ),
        }))
        set((state) => ({
          tabs: state.tabs.map((t) =>
            t.openerTabId === tabId ? { ...t, openerTabId: path } : t
          ),
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
