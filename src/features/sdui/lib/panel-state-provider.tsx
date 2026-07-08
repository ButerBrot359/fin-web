import type { ReactNode } from 'react'

import {
  SduiSessionProvider,
  type SduiSessionValue,
} from './sdui-session-context'
import type { PanelEntry } from './stores/panel-store'

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
    getSession: () => ({
      formSessionId: panel.session?.formSessionId ?? null,
      revision: panel.session?.revision ?? null,
    }),
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
