import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect } from '../types/view'
import { ViewConflictError, viewTransport } from '../api/view-transport'
import { applyValuePatches } from './patch-applier'
import { usePanelStore } from './stores/panel-store'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'

// Выбор в дочерней панели (реф-пикер) ретранслируется в родительскую сессию
// командой ref.select. Родитель — либо панель в стеке, либо корневая форма.
export function relaySelectionToParent(
  effect: ViewEffect,
  playEffects: (effects: ViewEffect[]) => void,
): void {
  if (!effect.applyToParentSessionId || !effect.applyToParentTargetNodeId || !effect.applyToParentValue) {
    return
  }
  const panels = usePanelStore.getState()
  const parentPanel = panels.findBySessionId(effect.applyToParentSessionId)
  const tree = useTreeStore.getState()
  const parentRevision = parentPanel?.session?.revision ?? tree.revision

  void viewTransport
    .post({
      formSessionId: effect.applyToParentSessionId,
      revision: parentRevision,
      action: {
        type: 'COMMAND',
        command: `ref.select:${effect.applyToParentTargetNodeId}`,
        value: effect.applyToParentValue,
      },
    })
    .then((res) => {
      if (parentPanel) {
        usePanelStore.getState().updateSession(parentPanel.panelId, res.revision)
      } else {
        const vs = useViewStateStore.getState()
        tree.bumpRevision(res.revision)
        tree.clearAllErrors()
        tree.applyPatches(res.patches ?? [])
        applyValuePatches(res.patches ?? [], vs.setFromServer)
        vs.merge(res.statePatch ?? {})
      }
      playEffects(res.effects ?? [])
    })
    .catch((error) => {
      if (error instanceof ViewConflictError && error.data.code === 'SESSION_NOT_FOUND') {
        showToast('warning', 'Форма устарела, выбор не применён')
      } else {
        showToast('error', error instanceof Error ? error.message : 'Ошибка')
      }
    })
}
