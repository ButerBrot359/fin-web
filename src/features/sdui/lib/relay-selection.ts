import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect, ViewResponse } from '../types/view'
import { ViewConflictError, viewTransport } from '../api/view-transport'
import { applyValuePatches } from './patch-applier'
import { validatePatches } from './validation'
import { usePanelStore } from './stores/panel-store'
import { getPanelPatchSink } from './panel-patch-registry'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'

function applyRelayResponse(
  res: ViewResponse,
  parentPanelId: string | undefined,
  playEffects: (effects: ViewEffect[]) => void
): void {
  if (parentPanelId !== undefined) {
    usePanelStore.getState().updateSession(parentPanelId, res.revision)
    // Патчи ответа адресованы узлам РОДИТЕЛЬСКОЙ панели (поле, в которое
    // подставляется выбранное значение). Раньше здесь обновлялась только
    // ревизия, а patches/statePatch отбрасывались: выбор во вложенной панели
    // доезжал до сервера, но в окне-родителе поле оставалось пустым.
    // Порядок тот же, что в dispatch: ревизия → сброс ошибок → патчи дерева →
    // патчи значений → statePatch → эффекты.
    const sink = getPanelPatchSink(parentPanelId)
    // Нет приёмника — панель уже размонтирована (успели закрыть): применять
    // патчи некуда, но ревизия обновлена и эффекты сыграть надо.
    if (sink) {
      sink.clearAllErrors()
      const patches = validatePatches(res.patches)
      sink.applyTreePatches(patches)
      applyValuePatches(patches, sink.setFromServer)
      sink.merge(res.statePatch ?? {})
    }
  } else {
    const tree = useTreeStore.getState()
    const vs = useViewStateStore.getState()
    tree.bumpRevision(res.revision)
    tree.clearAllErrors()
    const patches = validatePatches(res.patches)
    tree.applyPatches(patches)
    applyValuePatches(patches, vs.setFromServer)
    vs.merge(res.statePatch ?? {})
  }
  playEffects(res.effects ?? [])
}

// Выбор в дочерней панели (реф-пикер) ретранслируется в родительскую сессию
// готовой командой applyToParentCommand. Родитель — либо панель в стеке, либо корневая форма.
export function relaySelectionToParent(
  effect: ViewEffect,
  playEffects: (effects: ViewEffect[]) => void
): void {
  if (
    !effect.applyToParentSessionId ||
    !effect.applyToParentCommand ||
    !effect.applyToParentValue
  ) {
    return
  }
  const panels = usePanelStore.getState()
  const parentPanel = panels.findBySessionId(effect.applyToParentSessionId)
  const tree = useTreeStore.getState()
  const parentRevision = parentPanel?.session?.revision ?? tree.revision
  const parentPanelId = parentPanel?.panelId

  const action = {
    type: 'COMMAND' as const,
    command: effect.applyToParentCommand,
    value: effect.applyToParentValue,
  }

  void viewTransport
    .post({
      formSessionId: effect.applyToParentSessionId,
      revision: parentRevision,
      action,
    })
    .then((res) => {
      applyRelayResponse(res, parentPanelId, playEffects)
    })
    .catch((error) => {
      if (
        error instanceof ViewConflictError &&
        error.data.code === 'STALE_REVISION'
      ) {
        const freshRevision = error.data.currentRevision ?? parentRevision
        void viewTransport
          .post({
            formSessionId: effect.applyToParentSessionId,
            revision: freshRevision,
            action,
          })
          .then((res) => {
            applyRelayResponse(res, parentPanelId, playEffects)
          })
          .catch((retryError) => {
            if (
              retryError instanceof ViewConflictError &&
              retryError.data.code === 'SESSION_NOT_FOUND'
            ) {
              showToast('warning', i18n.t('sdui.refSelectStale'))
            } else {
              showToast(
                'error',
                retryError instanceof Error
                  ? retryError.message
                  : i18n.t('sdui.error')
              )
            }
          })
      } else if (
        error instanceof ViewConflictError &&
        error.data.code === 'SESSION_NOT_FOUND'
      ) {
        showToast('warning', i18n.t('sdui.refSelectStale'))
      } else {
        showToast(
          'error',
          error instanceof Error ? error.message : i18n.t('sdui.error')
        )
      }
    })
}
