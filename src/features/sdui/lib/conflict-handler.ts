import i18n from 'i18next'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ConflictError } from '../types/view'

export interface ConflictSession {
  setSession: (id: string, revision: number) => void
  replaceAll: (state: Record<string, unknown>) => void
}

export function handleConflict(
  err: ConflictError,
  session: ConflictSession,
  retry: (() => Promise<boolean>) | null,
  reopen: () => Promise<void>
): void {
  if (err.code === 'STALE_REVISION') {
    showToast('info', i18n.t('sdui.conflict.staleRevision'))
    if (err.formSessionId && err.currentRevision != null) {
      session.setSession(err.formSessionId, err.currentRevision)
    }
    if (err.snapshot?.state) {
      session.replaceAll(err.snapshot.state)
    }
    if (retry) void retry()
  } else if (err.code === 'SESSION_NOT_FOUND') {
    showToast('warning', i18n.t('sdui.conflict.sessionNotFound'))
    void reopen()
  } else if (err.code === 'PRODUCTION_CALENDAR_STATE_CONFLICT') {
    // SCRUM-277 v3 §4.1: стейл draftId/expectedDraftVersion (две вкладки,
    // повтор команды). Ретраить со старой версией нельзя — только переоткрыть
    // draft свежим OPEN; retry намеренно не вызывается.
    showToast('warning', i18n.t('sdui.conflict.productionCalendarState'))
    void reopen()
  }
}
