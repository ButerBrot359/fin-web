import { beforeEach, describe, expect, it, vi } from 'vitest'

import { viewTransport } from '../api/view-transport'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import {
  clearDiscardDraftClose,
  consumeDiscardDraftClose,
  discardTabSession,
  markDiscardDraftClose,
} from './close-intent'

const ROUTE = '/documents/Tabel/new'

describe('close-intent (SCRUM-276, черновики форм)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    clearDiscardDraftClose(ROUTE)
    useSduiCacheStore.getState().remove(ROUTE)
  })

  it('интент одноразовый: consume возвращает true один раз', () => {
    markDiscardDraftClose(ROUTE)
    expect(consumeDiscardDraftClose(ROUTE)).toBe(true)
    expect(consumeDiscardDraftClose(ROUTE)).toBe(false)
  })

  it('clear снимает залежавшийся интент', () => {
    markDiscardDraftClose(ROUTE)
    clearDiscardDraftClose(ROUTE)
    expect(consumeDiscardDraftClose(ROUTE)).toBe(false)
  })

  it('без кэша (активная вкладка) — помечает интент, transport не трогает', () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue({} as never)
    discardTabSession(ROUTE)
    expect(post).not.toHaveBeenCalled()
    expect(consumeDiscardDraftClose(ROUTE)).toBe(true)
  })

  it('с кэшем (неактивная вкладка) — CLOSE c discardDraft и чистка кэша', () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue({} as never)
    useSduiCacheStore.getState().save(ROUTE, {
      root: { id: 'r', type: 'SCREEN' } as never,
      formSessionId: 'fs-42',
      revision: 7,
      viewState: {},
      dirty: true,
    })

    discardTabSession(ROUTE)

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        formSessionId: 'fs-42',
        action: { type: 'CLOSE', discardDraft: true },
      })
    )
    expect(useSduiCacheStore.getState().get(ROUTE)).toBeUndefined()
    // Интент не ставится: экран этой вкладки не смонтирован
    expect(consumeDiscardDraftClose(ROUTE)).toBe(false)
  })
})
