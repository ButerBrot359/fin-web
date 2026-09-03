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

  // SCRUM-366: фолбэк `code` удалён как мёртвый — источник кода только `error`,
  // рассинхрон приоритета ключей с parse-view-error устранён.
  it('ключ `code` игнорируется, код берётся только из error', () => {
    const result = normalizeConflictBody({ code: 'STALE_REVISION', error: 'X' })
    expect(result.code).toBe('X')
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

  // SCRUM-330: OBJECT_LOCKED/LOCK_CONFLICT несут пользовательский текст в
  // стандартном поле message — он должен доехать до conflict-handler
  it('переносит message стандартного тела ошибки', () => {
    const result = normalizeConflictBody({
      error: 'OBJECT_LOCKED',
      message: 'Не удалось заблокировать «Больничный лист (id=1)»',
    })
    expect(result.code).toBe('OBJECT_LOCKED')
    expect(result.message).toBe(
      'Не удалось заблокировать «Больничный лист (id=1)»'
    )
  })
})
