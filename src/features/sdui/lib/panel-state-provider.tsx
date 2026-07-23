import type { ReactNode } from 'react'

import {
  SduiSessionProvider,
  type SduiSessionValue,
} from './sdui-session-context'
import type { PanelEntry } from './stores/panel-store'
import { useTreeStore } from './stores/tree-store'

const warnReadOnly = () => {
  console.warn('[sdui] panel tab is read-only, mutation ignored')
}

// Read-only сессия для SDUI-панели в workspace-вкладке. Движения — read-only
// представление (спека §2.4): мутаций/патчей из вкладки не бывает, поэтому все
// сеттеры — warn+noop, dirty всегда false. Значения читаются из снимка
// viewState PanelEntry (актуальный снимок кладёт dispatch при открытии).
export const PanelStateProvider = ({
  panel,
  children,
}: {
  panel: PanelEntry
  children: ReactNode
}) => {
  const sessionValue: SduiSessionValue = {
    kind: 'panel',
    // Команды из childState-панели (напр. переход к документу из related-docs)
    // адресуются сессии формы-владельца: без fallback на root-стор dispatch
    // ушёл бы с formSessionId=null и получил 409 SESSION_NOT_FOUND. Патчи ответа
    // по-прежнему дропаются (warnReadOnly) — панель остаётся read-only, но
    // эффекты (navigate, openDialog) играют штатно. SCRUM-265 v1 §4.4.
    getSession: () => {
      if (panel.session) {
        return {
          formSessionId: panel.session.formSessionId,
          revision: panel.session.revision,
        }
      }
      const s = useTreeStore.getState()
      return { formSessionId: s.formSessionId, revision: s.revision }
    },
    getValue: (binding) => (binding ? panel.viewState[binding] : undefined),
    setValue: warnReadOnly,
    setFromServer: warnReadOnly,
    getAll: () => panel.viewState,
    replaceAll: warnReadOnly,
    merge: warnReadOnly,
    isDirty: false,
    resetDirty: () => {},
    tree: panel.node,
    setRoot: warnReadOnly,
    setSession: warnReadOnly,
    bumpRevision: warnReadOnly,
    applyTreePatches: warnReadOnly,
    clearAllErrors: () => {},
  }

  return (
    <SduiSessionProvider value={sessionValue}>{children}</SduiSessionProvider>
  )
}
