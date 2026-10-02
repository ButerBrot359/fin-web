import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type {
  ActionBehavior,
  ViewAction,
  ViewNode,
  ViewResponse,
} from '../types/view'
import { viewTransport } from '../api/view-transport'
import { applyServerPatches } from './apply-view-response'
import { acquireFormTurn } from './form-dispatch-queue'
import { findNode } from './patch-applier'
import { isRetryableAfterReopen } from './reopen-retry-policy'
import {
  collectRestorableFields,
  restoreEventAction,
  type RestorableField,
} from './reopen-restore-fields'
import type { SduiSessionValue } from './sdui-session-context'

export interface ReopenPreservingDeps {
  session: SduiSessionValue
  action: ViewAction
  behavior?: ActionBehavior | null
  openForm: (onOpenResponse: (res: ViewResponse) => void) => Promise<boolean>
  retry: () => Promise<boolean>
}

const noEffects = () => undefined

function currentTree(session: SduiSessionValue): ViewNode | null {
  return session.getTree?.() ?? session.tree
}

function retriedEdit(
  session: SduiSessionValue,
  action: ViewAction,
  clientState: Record<string, unknown>
): { binding: string; value: unknown } | null {
  if (action.type !== 'EVENT' || !action.sourceNodeId) return null
  const tree = currentTree(session)
  const binding = tree ? findNode(tree, action.sourceNodeId)?.binding : null
  if (!binding) return null
  const value = Object.prototype.hasOwnProperty.call(clientState, binding)
    ? clientState[binding]
    : action.value
  return { binding, value }
}

function overlay(
  session: SduiSessionValue,
  values: { binding: string; value: unknown }[]
): void {
  if (values.length === 0) return
  values.forEach(({ binding, value }) => {
    session.setFromServer(binding, value)
  })
  session.setDirty(true)
}

async function sendRestoreEvents(
  session: SduiSessionValue,
  fields: RestorableField[]
): Promise<boolean> {
  const { formSessionId } = session.getSession()
  if (!formSessionId) return false
  const release = await acquireFormTurn(formSessionId)
  try {
    for (const field of fields) {
      if (session.getSession().formSessionId !== formSessionId) return false
      const res = await viewTransport.post({
        formSessionId,
        revision: session.getSession().revision,
        action: restoreEventAction(field),
      })
      applyServerPatches(session, res, {
        clearErrors: false,
        playEffects: noEffects,
      })
      if (res.commandFailed === true) return false
    }
    return true
  } catch {
    return false
  } finally {
    release()
  }
}

export async function reopenPreservingClientState(
  deps: ReopenPreservingDeps
): Promise<void> {
  const { session, action, behavior } = deps
  const clientState = { ...session.getAll() }
  const wasDirty = session.isDirty || action.type === 'EVENT'

  let opened: ViewResponse | null = null
  const ok = await deps.openForm((res) => {
    opened = res
  })
  const openRes = opened as ViewResponse | null
  if (!ok || !openRes) return

  const willRetry = isRetryableAfterReopen(action, behavior)
  const edit = willRetry ? retriedEdit(session, action, clientState) : null
  const fields =
    wasDirty && openRes.formDirty !== true
      ? collectRestorableFields(
          currentTree(session),
          clientState,
          openRes.state ?? {},
          willRetry && action.type === 'EVENT' ? action.sourceNodeId : undefined
        )
      : []
  const keep = edit ? [...fields, edit] : fields

  overlay(session, keep)
  if (fields.length === 0) {
    if (willRetry) void deps.retry()
    return
  }

  const restored = await sendRestoreEvents(session, fields)
  overlay(session, keep)
  if (!restored) {
    showToast('warning', i18n.t('sdui.conflict.sessionRestoreFailed'))
    return
  }
  showToast('info', i18n.t('sdui.conflict.sessionRestored'))
  if (willRetry) void deps.retry()
}
