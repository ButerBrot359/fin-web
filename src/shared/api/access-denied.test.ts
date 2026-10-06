import { describe, expect, it } from 'vitest'

import {
  classifyAccessError,
  parseBlobErrorBody,
  readErrorBody,
  PASSWORD_CHANGE_REQUIRED_MESSAGE,
} from './access-denied'

describe('classifyAccessError (SCRUM-400 §3.2/§4.3)', () => {
  it('FORBIDDEN и ACCESS_DENIED — оба отказ по правам (переходный период)', () => {
    for (const code of ['FORBIDDEN', 'ACCESS_DENIED']) {
      const kind = classifyAccessError(403, code, 'Нет права', 'SESSION')
      expect(kind?.kind).toBe('access-denied')
    }
  })

  it('scope TARGET читается; отсутствующий и неизвестный → SESSION', () => {
    const target = classifyAccessError(403, 'FORBIDDEN', 'x', 'TARGET')
    expect(target?.kind === 'access-denied' && target.denial.scope).toBe(
      'TARGET'
    )
    for (const raw of [undefined, 'WHATEVER', 42]) {
      const kind = classifyAccessError(403, 'FORBIDDEN', 'x', raw)
      expect(kind?.kind === 'access-denied' && kind.denial.scope).toBe(
        'SESSION'
      )
    }
  })

  it('обязательная смена пароля распознаётся ДО предиката по точному message', () => {
    const kind = classifyAccessError(
      403,
      'FORBIDDEN',
      PASSWORD_CHANGE_REQUIRED_MESSAGE
    )
    expect(kind?.kind).toBe('password-change')
  })

  it('ACCOUNT_INELIGIBLE — не отказ по правам, а конец сессии', () => {
    const kind = classifyAccessError(
      403,
      'ACCOUNT_INELIGIBLE',
      'Вход запрещён: учётная запись недействительна'
    )
    expect(kind?.kind).toBe('account-ineligible')
  })

  it('не-403 и неизвестный код — null (обычная ошибка)', () => {
    expect(classifyAccessError(404, 'NOT_FOUND', 'x')).toBeNull()
    expect(classifyAccessError(403, 'SOMETHING_ELSE', 'x')).toBeNull()
    expect(classifyAccessError(403, undefined, 'x')).toBeNull()
  })
})

describe('parseBlobErrorBody (SCRUM-400 §8.4)', () => {
  it('JSON-ошибка в Blob разбирается (тело 403 печати)', async () => {
    const body = {
      status: 403,
      error: 'FORBIDDEN',
      message: 'Нет права на печать: Документ «Табель»',
    }
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
    const parsed = await parseBlobErrorBody(blob)
    expect(readErrorBody(parsed).message).toBe(
      'Нет права на печать: Документ «Табель»'
    )
  })

  it('настоящий файл (не json) — null', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
    expect(await parseBlobErrorBody(blob)).toBeNull()
  })

  it('не Blob — null', async () => {
    expect(await parseBlobErrorBody({ message: 'x' })).toBeNull()
  })
})
