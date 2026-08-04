import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewResponse } from '../types/view'
import {
  fetchRelatedDocsView,
  postRelatedDocsAction,
  type RelatedDocsAction,
} from '../api/related-docs-api'
import { openDialogAsPanel } from './open-dialog-panel'
import { useConfirmStore } from './stores/confirm-store'
import { useRelatedDocsStore } from './stores/related-docs-store'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

// Эффекты session-less ответов related-documents (бэк-спека §3.2–3.3):
// openDialog заменяет содержимое той же workspace-вкладки (tabKey/panelId
// пер-anchor), notify — тост. Зеркало open-movements.ts.
function applyEffects(res: ViewResponse): void {
  for (const effect of res.effects ?? []) {
    if (effect.type === 'openDialog') {
      openDialogAsPanel(effect)
    } else if (effect.type === 'notify') {
      showToast(
        (effect.level as ToastLevel | undefined) ?? 'info',
        effect.message ?? ''
      )
    }
  }
}

export async function openRelatedDocsForEntry(
  entryId: string,
  anchorId?: string
): Promise<void> {
  applyEffects(await fetchRelatedDocsView(entryId, anchorId))
}

interface RelatedCommandContext {
  anchorId: string
  rootId: string
  confirmMessageSet?: string
  confirmMessageUnset?: string
}

const ACTION_BY_COMMAND: Record<string, RelatedDocsAction> = {
  'related.post': 'post',
  'related.unpost': 'unpost',
  'related.toggleDeletionMark': 'toggle-deletion-mark',
}

const isRelatedCommand = (command: string): boolean =>
  command === 'related.refresh' ||
  command === 'related.setRoot' ||
  command in ACTION_BY_COMMAND

// Нет выделенной строки ⇒ notify, запрос не отправлять (бэк-спека §4.4).
// Маркеры обрыва в стор не попадают — их отсекает SubordinationTree.
function getSelection(anchorId: string) {
  const sel = useRelatedDocsStore.getState().selected[anchorId]
  if (!sel) {
    showToast('info', i18n.t('sdui.relatedDocs.noSelection'))
    return null
  }
  return sel
}

async function runAction(
  action: RelatedDocsAction,
  ctx: RelatedCommandContext
): Promise<void> {
  const sel = getSelection(ctx.anchorId)
  if (!sel) return
  if (action === 'toggle-deletion-mark') {
    // Подтверждение — нативный диалог с СЕРВЕРНЫМ текстом из props кнопки:
    // серверный эффект CONFIRM невыразим — у панели нет form-сессии
    const message = sel.isDeletionMarked
      ? ctx.confirmMessageUnset
      : ctx.confirmMessageSet
    if (message && !(await useConfirmStore.getState().ask(message))) return
  }
  applyEffects(
    await postRelatedDocsAction(action, sel.rowId, ctx.rootId, ctx.anchorId)
  )
}

// Перехват пяти команд тулбара «Связанных документов» (бэк-спека §4.4):
// транспорт фронтовый — HTTP-вызов вместо COMMAND в /api/view.
// true = команда наша (в том числе при некомплектных props — проглатываем,
// чтобы COMMAND без сессии не ушёл на бэк).
export function handleRelatedCommand(
  command: string,
  props: Record<string, unknown> | undefined
): boolean {
  if (!isRelatedCommand(command)) return false
  const anchorId = props?.anchorId
  const rootId = props?.rootId
  if (typeof anchorId !== 'string' || typeof rootId !== 'string') {
    if (import.meta.env.DEV) {
      console.warn(
        '[sdui] related-команда без anchorId/rootId в props',
        command
      )
    }
    return true
  }
  const ctx: RelatedCommandContext = {
    anchorId,
    rootId,
    confirmMessageSet: props?.confirmMessageSet as string | undefined,
    confirmMessageUnset: props?.confirmMessageUnset as string | undefined,
  }
  if (command === 'related.refresh') {
    void openRelatedDocsForEntry(ctx.rootId, ctx.anchorId)
    return true
  }
  if (command === 'related.setRoot') {
    const sel = getSelection(ctx.anchorId)
    if (sel) void openRelatedDocsForEntry(sel.rowId, ctx.anchorId)
    return true
  }
  void runAction(ACTION_BY_COMMAND[command], ctx)
  return true
}
