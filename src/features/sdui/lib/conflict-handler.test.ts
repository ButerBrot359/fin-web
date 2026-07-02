import { describe, expect, it, vi } from 'vitest'

import type { ConflictError } from '../types/view'
import { handleConflict } from './conflict-handler'

vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: vi.fn() }))

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
    handleConflict({ code: 'SESSION_NOT_FOUND' } as ConflictError, session, null, reopen)
    expect(reopen).toHaveBeenCalledOnce()
    expect(session.setSession).not.toHaveBeenCalled()
  })
})
