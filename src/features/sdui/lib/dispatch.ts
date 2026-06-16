import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewAction, ViewEffect } from '../types/view'
import { viewTransport, ViewConflictError } from '../api/view-transport'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'
import { applyValuePatches } from './patch-applier'
import { handleConflict } from './conflict-handler'
import { createEffectHandler } from './effect-handler'

// Dialog state kept module-local — simple array-based stack for MVP
let dialogStack: ViewEffect[] = []
let dialogListeners: Array<() => void> = []

export function getDialogStack(): ViewEffect[] {
  return dialogStack
}

export function subscribeDialogs(listener: () => void): () => void {
  dialogListeners.push(listener)
  return () => {
    dialogListeners = dialogListeners.filter((l) => l !== listener)
  }
}

function notifyDialogListeners() {
  dialogListeners.forEach((l) => l())
}

export function popDialog(): void {
  dialogStack = dialogStack.slice(0, -1)
  notifyDialogListeners()
}

export function useSduiDispatch() {
  const location = useLocation()
  const navigate = useNavigate()

  const dispatch = useCallback(
    async (action: ViewAction): Promise<void> => {
      const { formSessionId, revision } = useTreeStore.getState()
      const { replaceAll, merge } = useViewStateStore.getState()
      const { setSession, setRoot, bumpRevision, applyPatches: applyTreePatches, clearAllErrors } =
        useTreeStore.getState()

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
          dialogStack = [...dialogStack, effect]
          notifyDialogListeners()
        },
        closeDialog: (id) => {
          dialogStack = dialogStack.filter(
            (d) => d.node?.id !== id,
          )
          notifyDialogListeners()
        },
      })

      const reopen = async () => {
        await dispatch({ type: 'OPEN' })
      }

      try {
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
          if (res.tree) setRoot(res.tree)
          replaceAll(res.state ?? {})
          // Apply handler.handleOpen patches (e.g. required/enabled/label defaults)
          applyTreePatches(res.patches ?? [])
          applyValuePatches(res.patches ?? [], useViewStateStore.getState().set)
          effectHandler.playAll(res.effects ?? [])
        } else if (action.type === 'CLOSE') {
          // reset is done by SduiScreen on unmount
        } else {
          // EVENT or COMMAND — order is critical: revision → clear old errors → tree patches → value patches → effects
          bumpRevision(res.revision)
          if (action.type === 'COMMAND') clearAllErrors()
          applyTreePatches(res.patches ?? [])
          applyValuePatches(res.patches ?? [], useViewStateStore.getState().set)
          merge(res.statePatch ?? {})
          effectHandler.playAll(res.effects ?? [])
        }
      } catch (error) {
        if (error instanceof ViewConflictError) {
          handleConflict(error.data, action, reopen)
        } else {
          const message =
            error instanceof Error ? error.message : 'Ошибка запроса'
          showToast('error', message)
        }
      }
    },
    [location.pathname, location.search, navigate],
  )

  return dispatch
}
