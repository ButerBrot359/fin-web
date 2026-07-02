import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewAction } from '../types/view'
import { viewTransport, ViewConflictError } from '../api/view-transport'
import { applyValuePatches } from './patch-applier'
import { validatePatches } from './validation'
import { handleConflict } from './conflict-handler'
import { createEffectHandler } from './effect-handler'
import { useSduiSession } from './sdui-session-context'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'
import { usePanelStore, type PanelEntry } from './stores/panel-store'
import { flushAllPendingTableCommits } from './pending-table-commits'
import { relaySelectionToParent } from './relay-selection'

const SAVE_COMMANDS = ['save', 'saveAndClose', 'post', 'postAndClose']

export function useSduiDispatch() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = useSduiSession()

  const dispatch = useCallback(
    async (action: ViewAction, isRetry = false): Promise<boolean> => {
      const { formSessionId, revision } = session.getSession()
      const { replaceAll, merge, setSession, setRoot, bumpRevision, applyTreePatches, clearAllErrors, setFromServer, resetDirty } = session

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
          const presentation =
            (effect.node?.props?.presentation as string) ?? 'modal'
          const entry: PanelEntry = {
            panelId: effect.node?.id ?? String(Date.now()),
            node: effect.node!,
            presentation: presentation as 'drawer' | 'modal' | 'page',
            viewState: effect.childState ?? {},
          }
          if (effect.sessionId) {
            entry.session = {
              formSessionId: effect.sessionId,
              revision: effect.childRevision ?? 0,
              parentSessionId: session.getSession().formSessionId ?? undefined,
              targetNodeId: undefined,
            }
          }
          usePanelStore.getState().push(entry)
        },
        closeDialog: (effect) => {
          usePanelStore.getState().remove(effect.id)
          relaySelectionToParent(effect, (effects) => effectHandler.playAll(effects))
        },
      })

      const reopen = async () => {
        await dispatch({ type: 'OPEN' })
      }

      try {
        if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
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
          if (res.tree) setRoot(res.tree)
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
          effectHandler.playAll(res.effects ?? [])
          if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
            resetDirty()
          }
        }
        return true
      } catch (error) {
        if (error instanceof ViewConflictError) {
          const retry =
            !isRetry && action.type !== 'OPEN' ? () => dispatch(action, true) : null
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
