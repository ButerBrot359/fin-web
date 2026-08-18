import { create } from 'zustand'

import type { ViewNode } from '../../types/view'

export interface PanelEntry {
  panelId: string
  node: ViewNode
  presentation: 'drawer' | 'modal' | 'page'
  session?: {
    formSessionId: string
    revision: number
    parentSessionId?: string
    targetNodeId?: string
  }
  viewState: Record<string, unknown>
  // Панель пришла с childState-снимком (self-contained, read-only: движения,
  // related-docs). Без него панель без сессии (choice-drawer, ref.showAll)
  // живёт в РОДИТЕЛЬСКОМ контексте экрана — см. dialog-host (SCRUM-265 v1).
  hasChildState?: boolean
  // Панель показывается workspace-вкладкой (Блок D): DialogHost её пропускает,
  // живёт до закрытия вкладки (переживает reset() при размонтировании формы).
  openInWorkspaceTab?: boolean
  tabKey?: string
}

interface PanelStore {
  panels: PanelEntry[]
  push: (p: PanelEntry) => void
  pop: () => void
  remove: (panelId: string) => void
  updateSession: (panelId: string, revision: number) => void
  findBySessionId: (sessionId: string) => PanelEntry | undefined
  reset: () => void
}

/**
 * Панели, которые закрываются вместе с `panelId`: сама панель и всё, что открыто
 * ПОВЕРХ неё (§3.2 спеки вложенного openDialog — закрытие родителя закрывает и
 * вложенные панели).
 *
 * Правило позиционное, а не по `session.parentSessionId`: у части вложенных
 * панелей сессии нет вовсе (панель выбора приезжает без `sessionId` и живёт в
 * контексте родителя), и по ссылке на родителя они не находятся. В стеке
 * модальных диалогов «выше» и означает «открыто из».
 *
 * Панели workspace-вкладок исключены: они живут не в стеке диалогов, а в своей
 * вкладке, и закрытие чужого диалога их не касается.
 */
function withoutPanelAndAbove(
  panels: PanelEntry[],
  panelId: string
): PanelEntry[] {
  const index = panels.findIndex((p) => p.panelId === panelId)
  if (index === -1) return panels
  return panels.filter(
    (p, i) => i < index || (i > index && p.openInWorkspaceTab === true)
  )
}

export const usePanelStore = create<PanelStore>((set, get) => ({
  panels: [],
  push: (p) => {
    set((s) => {
      if (
        import.meta.env.DEV &&
        s.panels.some((x) => x.panelId === p.panelId)
      ) {
        // panelId — это node.id панели, и по нему же сервер её закрывает
        // (closeDialog.id). Дубль означает два элемента стека с одним ключом:
        // закрытие погасит оба. Пока панель была одна, случай был недостижим.
        console.warn('[sdui] панель с таким id уже открыта', p.panelId)
      }
      return { panels: [...s.panels, p] }
    })
  },
  pop: () => set((s) => ({ panels: s.panels.slice(0, -1) })),
  remove: (panelId) =>
    set((s) => ({ panels: withoutPanelAndAbove(s.panels, panelId) })),
  updateSession: (panelId, revision) =>
    set((s) => ({
      panels: s.panels.map((p) =>
        p.panelId === panelId && p.session
          ? { ...p, session: { ...p.session, revision } }
          : p
      ),
    })),
  findBySessionId: (sessionId) =>
    get().panels.find((p) => p.session?.formSessionId === sessionId),
  // reset зовётся при размонтировании SduiScreen (sdui-screen.tsx): диалоги
  // умирают вместе с формой, а панели workspace-вкладок самодостаточны
  // (childState) и живут до закрытия своей вкладки.
  reset: () =>
    set((s) => ({ panels: s.panels.filter((p) => p.openInWorkspaceTab) })),
}))
