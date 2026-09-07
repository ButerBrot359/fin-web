import { describe, expect, it } from 'vitest'

import type { FaceQualityReason } from '../types/face-auth'
import { faceOutcomeMessageKey } from './outcome-message'

/** Содержимое неважно: проверяется, что успех не порождает сообщения, а не что в токенах. */
const tokens = {
  accessToken: 'a',
  refreshToken: 'r',
  user: { login: 'Иванов Иван' },
} as never

describe('faceOutcomeMessageKey', () => {
  it('молчит при успехе и до завершения попытки', () => {
    expect(faceOutcomeMessageKey(null)).toBeNull()
    expect(faceOutcomeMessageKey({ kind: 'success', tokens })).toBeNull()
  })

  it('на отказ по существу даёт общий текст без причины', () => {
    // Сервер не различает «лицо не живое» и «лицо не то» — клиент не вправе додумывать за него.
    expect(faceOutcomeMessageKey({ kind: 'rejected' })).toBe(
      'auth.face.errorRejected'
    )
  })

  it('различает лимит попыток и недоступность движка', () => {
    // Разница существенная для пользователя: при 429 ждать бесполезно, при 503 попытка даже
    // не израсходована и повтор осмыслен.
    expect(faceOutcomeMessageKey({ kind: 'rateLimited' })).toBe(
      'auth.face.errorRateLimited'
    )
    expect(faceOutcomeMessageKey({ kind: 'unavailable' })).toBe(
      'auth.face.errorUnavailable'
    )
  })

  it('на каждую причину качества даёт свой ключ', () => {
    const reasons: FaceQualityReason[] = [
      'NO_FACE',
      'MULTIPLE_FACES',
      'FACE_TOO_SMALL',
      'FACE_TOO_LARGE',
      'FACE_MOVED',
      'LOW_FRAME_RATE',
      'LOW_SIGNAL',
      'TOO_FEW_FRAMES',
      'TOO_MANY_FRAMES',
    ]

    for (const reason of reasons) {
      expect(faceOutcomeMessageKey({ kind: 'quality', reason })).toBe(
        `auth.face.quality${reason}`
      )
    }
  })

  it('отличает запрет доступа к камере от её отсутствия', () => {
    expect(
      faceOutcomeMessageKey({ kind: 'clientError', detail: 'NotAllowedError' })
    ).toBe('auth.face.errorCameraDenied')
    expect(
      faceOutcomeMessageKey({ kind: 'clientError', detail: 'NotFoundError' })
    ).toBe('auth.face.errorCameraMissing')
  })

  it('прочие клиентские сбои сводит к общему тексту', () => {
    expect(
      faceOutcomeMessageKey({
        kind: 'clientError',
        detail: 'Error: socket hang up',
      })
    ).toBe('auth.face.errorGeneric')
  })
})
