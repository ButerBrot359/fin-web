import { describe, expect, it, vi } from 'vitest'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ConflictError } from '../types/view'
import { handleConflict } from './conflict-handler'

vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))
// t() → ключ: в тестах i18n не инициализирован (t вернул бы undefined)
vi.mock('i18next', () => ({ default: { t: (key: string) => key } }))

const staleErr: ConflictError = {
  code: 'STALE_REVISION',
  formSessionId: 'fs-1',
  currentRevision: 7,
  snapshot: { state: { a: 1 } },
} as ConflictError

describe('handleConflict', () => {
  it('STALE_REVISION: обновляет ПЕРЕДАННУЮ сессию и ретраит действие', () => {
    const session = { setSession: vi.fn(), replaceAll: vi.fn() }
    const retry = vi.fn(() => Promise.resolve(true))
    handleConflict(staleErr, session, retry, () => Promise.resolve())
    expect(session.setSession).toHaveBeenCalledWith('fs-1', 7)
    expect(session.replaceAll).toHaveBeenCalledWith({ a: 1 })
    expect(retry).toHaveBeenCalledOnce()
  })

  it('SESSION_NOT_FOUND: вызывает reopen, не трогая сессию', () => {
    const session = { setSession: vi.fn(), replaceAll: vi.fn() }
    const reopen = vi.fn(() => Promise.resolve())
    handleConflict(
      { code: 'SESSION_NOT_FOUND' } as ConflictError,
      session,
      null,
      reopen
    )
    expect(reopen).toHaveBeenCalledOnce()
    expect(session.setSession).not.toHaveBeenCalled()
  })

  // SCRUM-277 v3 §4.1: стейл draftId/expectedDraftVersion производственного
  // календаря — переоткрыть draft, НЕ ретраить команду со старой версией.
  it('PRODUCTION_CALENDAR_STATE_CONFLICT: reopen без retry', () => {
    const session = { setSession: vi.fn(), replaceAll: vi.fn() }
    const retry = vi.fn(() => Promise.resolve(true))
    const reopen = vi.fn(() => Promise.resolve())
    handleConflict(
      { code: 'PRODUCTION_CALENDAR_STATE_CONFLICT' } as ConflictError,
      session,
      retry,
      reopen
    )
    expect(reopen).toHaveBeenCalledOnce()
    expect(retry).not.toHaveBeenCalled()
    expect(session.setSession).not.toHaveBeenCalled()
  })

  // SCRUM-330 Работа 1: блокировки. Запись НЕ выполнена, но правки целы —
  // форму не сбрасываем, не переоткрываем, автоповтор не делаем.
  it('OBJECT_LOCKED: тост с message бэка, без retry/reopen/сброса формы', () => {
    vi.mocked(showToast).mockClear()
    const session = { setSession: vi.fn(), replaceAll: vi.fn() }
    const retry = vi.fn(() => Promise.resolve(true))
    const reopen = vi.fn(() => Promise.resolve())
    handleConflict(
      {
        code: 'OBJECT_LOCKED',
        message: 'Объект уже редактируется: пользователь anon@10.0.0.5',
      } as ConflictError,
      session,
      retry,
      reopen
    )
    expect(showToast).toHaveBeenCalledWith(
      'warning',
      'Объект уже редактируется: пользователь anon@10.0.0.5'
    )
    expect(retry).not.toHaveBeenCalled()
    expect(reopen).not.toHaveBeenCalled()
    expect(session.setSession).not.toHaveBeenCalled()
    expect(session.replaceAll).not.toHaveBeenCalled()
  })

  it('LOCK_CONFLICT без message: i18n-фолбэк, форма не трогается', () => {
    vi.mocked(showToast).mockClear()
    const session = { setSession: vi.fn(), replaceAll: vi.fn() }
    const reopen = vi.fn(() => Promise.resolve())
    handleConflict(
      { code: 'LOCK_CONFLICT' } as ConflictError,
      session,
      null,
      reopen
    )
    expect(showToast).toHaveBeenCalledWith(
      'warning',
      'sdui.conflict.lockConflict'
    )
    expect(reopen).not.toHaveBeenCalled()
    expect(session.replaceAll).not.toHaveBeenCalled()
  })
})
