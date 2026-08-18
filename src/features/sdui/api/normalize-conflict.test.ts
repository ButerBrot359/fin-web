import { describe, expect, it } from 'vitest'

import { normalizeConflictBody } from './normalize-conflict'

describe('normalizeConflictBody', () => {
  it('читает код конфликта из поля error (реальный провод, §2.6 спеки бэка)', () => {
    const body = {
      error: 'SESSION_NOT_FOUND',
      formSessionId: 'abc',
      reason: 'session not found or expired',
    }
    const result = normalizeConflictBody(body)
    expect(result.code).toBe('SESSION_NOT_FOUND')
    expect(result.formSessionId).toBe('abc')
  })

  it('ключ code игнорируется — бэк эмитит только error (SCRUM-362 B-8)', () => {
    expect(
      normalizeConflictBody({ code: 'STALE_REVISION', error: 'X' }).code
    ).toBe('X')
    expect(normalizeConflictBody({ code: 'STALE_REVISION' }).code).toBe('')
  })

  it('переносит currentRevision и snapshot как есть', () => {
    const result = normalizeConflictBody({
      error: 'STALE_REVISION',
      currentRevision: 7,
      snapshot: { state: { a: 1 } },
    })
    expect(result.currentRevision).toBe(7)
    expect(result.snapshot?.state).toEqual({ a: 1 })
  })

  it('не падает на мусорном теле — код пустой строкой', () => {
    expect(normalizeConflictBody(null).code).toBe('')
    expect(normalizeConflictBody('oops').code).toBe('')
  })
})
