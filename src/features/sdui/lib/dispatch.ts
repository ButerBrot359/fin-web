import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ActionBehavior, ViewAction } from '../types/view'
import { viewTransport, ViewConflictError } from '../api/view-transport'
import { applyValuePatches } from './patch-applier'
import { validatePatches } from './validation'
import { handleConflict } from './conflict-handler'
import { createEffectHandler } from './effect-handler'
import { isRetryableAfterReopen } from './reopen-retry-policy'
import { useSduiSession } from './sdui-session-context'
import { usePanelStore } from './stores/panel-store'
import { flushAllPendingTableCommits } from './pending-table-commits'
import { relaySelectionToParent } from './relay-selection'
import { openDialogAsPanel } from './open-dialog-panel'

export function useSduiDispatch() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = useSduiSession()

  const dispatch = useCallback(
    async (
      action: ViewAction,
      behavior?: ActionBehavior | null,
      isRetry = false,
    ): Promise<boolean> => {
      const { formSessionId, revision } = session.getSession()
      const { replaceAll, merge, setSession, setRoot, bumpRevision, applyTreePatches, clearAllErrors, setFromServer, resetDirty, closeAfter, setOnDirtyClose } = session

      // Поведение действия приходит с бэка (SCRUM-283). Фолбэки асимметричны намеренно:
      // забытый flush = молчаливая потеря правок ТЧ → безопасная сторона true;
      // забытые resetsDirty/closeAfter безвредны (заметны) → false.
      const shouldFlush = behavior?.flushPendingTables ?? true
      const shouldReset = behavior?.resetsDirty ?? false
      const shouldClose = behavior?.closeAfter ?? false

      const closeSession = async () => {
        if (formSessionId) {
          try {
            await viewTransport.post({
              formSessionId,
              action: { type: 'CLOSE' },
            })
          } catch {
            // best-effort
          }
        }
      }

      const effectHandler = createEffectHandler({
        navigate,
        closeSession,
        openDialog: (effect) => {
          openDialogAsPanel(effect, session.getSession().formSessionId ?? undefined)
        },
        closeDialog: (effect) => {
          if (effect.id) usePanelStore.getState().remove(effect.id)
          relaySelectionToParent(effect, (effects) => effectHandler.playAll(effects))
        },
      })

      const reopen = async () => {
        // isRetry: мы уже внутри повтора после восстановления — второй
        // SESSION_NOT_FOUND подряд означает нестабильный бэк; не зацикливаемся.
        if (isRetry) return
        // layoutCode обязателен для OPEN (§2.3 спеки SCRUM-244) — без него
        // переоткрытие уходило в цикл 409 → 400. Берём сохранённый с первого OPEN.
        const layoutCode = session.getLayoutCode?.() ?? undefined
        const ok = await dispatch({ type: 'OPEN', layoutCode })
        // Повторяем исходное действие, чтобы клик не терялся (кроме команд записи)
        if (ok && isRetryableAfterReopen(action, behavior)) {
          void dispatch(action, behavior, true)
        }
      }

      try {
        if (action.type === 'COMMAND' && shouldFlush) {
          try {
            await flushAllPendingTableCommits()
          } catch {
            showToast('error', i18n.t('sdui.tableFlushFailed'))
            return false
          }
        }

        const res = await viewTransport.post({
          formSessionId: action.type === 'OPEN' ? null : formSessionId,
          revision: action.type === 'OPEN' ? null : revision,
          layoutCode: action.type === 'OPEN'
            ? (action.layoutCode ?? null)
            : undefined,
          route: location.pathname + location.search,
          action,
        })

        if (action.type === 'OPEN') {
          setSession(res.formSessionId, res.revision)
          session.setLayoutCode?.(action.layoutCode ?? null)
          if (res.tree) setRoot(res.tree)
          setOnDirtyClose?.(res.onDirtyClose ?? null)
          replaceAll(res.state ?? {})
          // Apply handler.handleOpen patches (e.g. required/enabled/label defaults)
          const openPatches = validatePatches(res.patches)
          applyTreePatches(openPatches)
          applyValuePatches(openPatches, setFromServer)
          effectHandler.playAll(res.effects ?? [])
        } else if (action.type === 'CLOSE') {
          // reset is done by SduiScreen on unmount
        } else {
          // EVENT or COMMAND — order is critical: revision → clear old errors → tree patches → value patches → effects
          bumpRevision(res.revision)
          if (action.type === 'COMMAND') clearAllErrors()
          const patches = validatePatches(res.patches)
          applyTreePatches(patches)
          applyValuePatches(patches, setFromServer)
          merge(res.statePatch ?? {})
          effectHandler.playAll(res.effects ?? [])       // navigate играет здесь…
          if (action.type === 'COMMAND') {
            if (shouldReset) resetDirty()
            if (shouldClose) closeAfter?.()               // …закрытие — после эффектов
          }
        }
        return true
      } catch (error) {
        if (error instanceof ViewConflictError) {
          const retry =
            !isRetry && action.type !== 'OPEN'
              ? () => dispatch(action, behavior, true)
              : null
          handleConflict(
            error.data,
            { setSession, replaceAll },
            retry,
            reopen,
          )
        } else {
          const message = error instanceof Error ? error.message : i18n.t('sdui.requestError')
          showToast('error', message)
        }
        return false
      }
    },
    [location.pathname, location.search, navigate, session],
  )

  return dispatch
}
