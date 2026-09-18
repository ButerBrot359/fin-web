import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect, ViewResponse } from '../types/view'
import { ViewConflictError, viewTransport } from '../api/view-transport'
import { applyServerPatches } from './apply-view-response'
import { usePanelStore } from './stores/panel-store'
import { getPanelPatchSink } from './panel-patch-registry'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'
import { applyCellValueLocally, parseCellTarget } from './cell-value-appliers'

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
    // Порядок тот же, что в dispatch — applyServerPatches; ревизию панели
    // бампит updateSession выше (у sink метода нет).
    const sink = getPanelPatchSink(parentPanelId)
    // Нет приёмника — панель уже размонтирована (успели закрыть): применять
    // патчи некуда, но ревизия обновлена и эффекты сыграть надо.
    if (sink) {
      applyServerPatches(sink, res, { clearErrors: true, playEffects })
    } else {
      playEffects(res.effects ?? [])
    }
  } else {
    const tree = useTreeStore.getState()
    const vs = useViewStateStore.getState()
    applyServerPatches(
      {
        bumpRevision: tree.bumpRevision,
        clearAllErrors: tree.clearAllErrors,
        applyTreePatches: tree.applyPatches,
        setFromServer: vs.setFromServer,
        merge: vs.merge,
      },
      res,
      { clearErrors: true, playEffects }
    )
  }
}

// Единый репортёр ошибок ретрансляции: устаревшая сессия родителя — штатный
// warning (панель пережила родителя), остальное — error с текстом.
function reportRelayError(error: unknown): void {
  if (
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
}

// Выбор в дочерней панели (реф-пикер) ретранслируется в родительскую сессию
// готовой командой applyToParentCommand. Родитель — либо панель в стеке, либо корневая форма.
export function relaySelectionToParent(
  effect: ViewEffect,
  playEffects: (effects: ViewEffect[]) => void
): void {
  if (!effect.applyToParentSessionId || !effect.applyToParentValue) {
    return
  }
  // ADR-0029, несохранённая строка ТЧ: команды НЕТ — это протокольный сигнал «применяет
  // родитель, локально». У такой строки нет БД-id, сервер её не искал и ничего не писал,
  // ретранслировать на сервер нечего: кладём значение в свою строку сами.
  if (!effect.applyToParentCommand) {
    const target = parseCellTarget(effect.applyToParentTargetNodeId)
    if (target) {
      applyCellValueLocally(
        target.columnNodeId,
        target.rowId,
        effect.applyToParentValue
      )
    }
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

  const post = (revision: number | null) =>
    viewTransport.post({
      formSessionId: effect.applyToParentSessionId,
      revision,
      action,
    })

  void (async () => {
    try {
      const res = await post(parentRevision)
      applyRelayResponse(res, parentPanelId, playEffects)
    } catch (error) {
      if (
        error instanceof ViewConflictError &&
        error.data.code === 'STALE_REVISION'
      ) {
        // Ревизия родителя устарела (например, он сам успел получить патчи):
        // один повтор со свежей ревизией из тела конфликта.
        const freshRevision = error.data.currentRevision ?? parentRevision
        try {
          const res = await post(freshRevision)
          applyRelayResponse(res, parentPanelId, playEffects)
        } catch (retryError) {
          reportRelayError(retryError)
        }
        return
      }
      reportRelayError(error)
    }
  })()
}
