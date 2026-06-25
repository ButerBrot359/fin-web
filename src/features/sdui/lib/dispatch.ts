import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewAction, ViewNode } from '../types/view'
import { viewTransport, ViewConflictError } from '../api/view-transport'
import { applyValuePatches } from './patch-applier'
import { handleConflict } from './conflict-handler'
import { createEffectHandler } from './effect-handler'
import { useSduiSession } from './sdui-session-context'
import { useTreeStore } from './stores/tree-store'
import { useViewStateStore } from './stores/view-state-store'
import { flushAllPendingTableCommits } from './pending-table-commits'

const SAVE_COMMANDS = ['save', 'saveAndClose', 'post', 'postAndClose']

// ─── Panel stack (replaces simple dialog stack) ───

export interface PanelEntry {
  panelId: string
  node: ViewNode
  presentation: 'drawer' | 'modal'
  session?: {
    formSessionId: string
    revision: number
    parentSessionId?: string
    targetNodeId?: string
  }
  viewState: Record<string, unknown>
}

let panelStack: PanelEntry[] = []
let panelListeners: Array<() => void> = []

export function getPanelStack(): PanelEntry[] {
  return panelStack
}

export function subscribePanels(listener: () => void): () => void {
  panelListeners.push(listener)
  return () => {
    panelListeners = panelListeners.filter((l) => l !== listener)
  }
}

function notifyPanelListeners() {
  panelListeners.forEach((l) => l())
}

export function popPanel(): void {
  panelStack = panelStack.slice(0, -1)
  notifyPanelListeners()
}

export function updatePanelSession(panelId: string, rev: number): void {
  panelStack = panelStack.map((p) =>
    p.panelId === panelId && p.session
      ? { ...p, session: { ...p.session, revision: rev } }
      : p,
  )
  notifyPanelListeners()
}

export function findPanelBySessionId(sessionId: string): PanelEntry | undefined {
  return panelStack.find((p) => p.session?.formSessionId === sessionId)
}

// Backward-compatible aliases
export const getDialogStack = getPanelStack
export const subscribeDialogs = subscribePanels
export const popDialog = popPanel

export function useSduiDispatch() {
  const location = useLocation()
  const navigate = useNavigate()
  const session = useSduiSession()

  const dispatch = useCallback(
    async (action: ViewAction): Promise<void> => {
      const formSessionId = session.formSessionId
      const revision = session.revision
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
            presentation: presentation as 'drawer' | 'modal',
            viewState: effect.childState ?? {},
          }
          if (effect.sessionId) {
            entry.session = {
              formSessionId: effect.sessionId,
              revision: effect.childRevision ?? 0,
              parentSessionId: session.formSessionId ?? undefined,
              targetNodeId: undefined,
            }
          }
          panelStack = [...panelStack, entry]
          notifyPanelListeners()
        },
        closeDialog: (effect) => {
          // Close the panel
          panelStack = panelStack.filter((p) => p.panelId !== effect.id)
          notifyPanelListeners()

          // If applyToParent fields are present — relay selection to parent session
          if (effect.applyToParentSessionId && effect.applyToParentTargetNodeId && effect.applyToParentValue) {
            const parentPanel = findPanelBySessionId(effect.applyToParentSessionId)

            // Parent is either a panel in the stack or the root form (global stores)
            const tree = useTreeStore.getState()
            const parentRevision = parentPanel?.session?.revision ?? tree.revision

            void viewTransport.post({
              formSessionId: effect.applyToParentSessionId,
              revision: parentRevision,
              action: {
                type: 'COMMAND',
                command: `ref.select:${effect.applyToParentTargetNodeId}`,
                value: effect.applyToParentValue,
              },
            }).then((res) => {
              if (parentPanel) {
                // Parent is a panel — update its session
                updatePanelSession(parentPanel.panelId, res.revision)
              } else {
                // Parent is root — apply to global stores
                const vs = useViewStateStore.getState()
                tree.bumpRevision(res.revision)
                tree.clearAllErrors()
                tree.applyPatches(res.patches ?? [])
                applyValuePatches(res.patches ?? [], vs.setFromServer)
                vs.merge(res.statePatch ?? {})
              }
              effectHandler.playAll(res.effects ?? [])
            }).catch((error) => {
              if (error instanceof ViewConflictError && error.data.code === 'SESSION_NOT_FOUND') {
                showToast('warning', 'Форма устарела, выбор не применён')
              } else {
                showToast('error', error instanceof Error ? error.message : 'Ошибка')
              }
            })
          }
        },
      })

      const reopen = async () => {
        await dispatch({ type: 'OPEN' })
      }

      try {
        if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
          await flushAllPendingTableCommits()
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
          applyTreePatches(res.patches ?? [])
          applyValuePatches(res.patches ?? [], setFromServer)
          effectHandler.playAll(res.effects ?? [])
        } else if (action.type === 'CLOSE') {
          // reset is done by SduiScreen on unmount
        } else {
          // EVENT or COMMAND — order is critical: revision → clear old errors → tree patches → value patches → effects
          bumpRevision(res.revision)
          if (action.type === 'COMMAND') clearAllErrors()
          applyTreePatches(res.patches ?? [])
          applyValuePatches(res.patches ?? [], setFromServer)
          merge(res.statePatch ?? {})
          effectHandler.playAll(res.effects ?? [])
          if (action.type === 'COMMAND' && SAVE_COMMANDS.includes(action.command ?? '')) {
            resetDirty()
          }
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
    [location.pathname, location.search, navigate, session],
  )

  return dispatch
}
