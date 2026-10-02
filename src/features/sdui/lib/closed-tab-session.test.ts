import { beforeEach, describe, expect, it, vi } from 'vitest'

import { viewTransport } from '../api/view-transport'
import { consumeDiscardDraftClose, discardTabSession } from './close-intent'
import {
  discardClosedFormDraft,
  releaseClosedTabScreen,
} from './closed-tab-session'
import {
  clearMountedScreenRoute,
  setMountedScreenRoute,
} from './mounted-screen'
import { useSduiCacheStore } from './stores/sdui-cache-store'

const cacheEntry = (dirty: boolean) => ({
  root: { id: 'r', type: 'SCREEN' } as never,
  formSessionId: 'fs-1',
  revision: 3,
  viewState: {},
  dirty,
})

describe('закрытие неактивной вкладки снимает SDUI-кэш и сессию (D12)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    useSduiCacheStore.setState({ cache: {} })
    clearMountedScreenRoute('/documents/X/1')
    consumeDiscardDraftClose('/documents/X/1')
  })

  it('чистая закрытая вкладка: кэш удалён, серверная сессия закрыта без discardDraft', () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue({} as never)
    useSduiCacheStore.getState().save('/documents/X/1', cacheEntry(false))

    releaseClosedTabScreen('/documents/X/1')

    expect(useSduiCacheStore.getState().get('/documents/X/1')).toBeUndefined()
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        formSessionId: 'fs-1',
        action: { type: 'CLOSE' },
      })
    )
  })

  it('экран смонтирован — release ничего не делает, CLOSE отправит размонтирование', () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue({} as never)
    useSduiCacheStore.getState().save('/documents/X/1', cacheEntry(true))
    setMountedScreenRoute('/documents/X/1')

    releaseClosedTabScreen('/documents/X/1')

    expect(post).not.toHaveBeenCalled()
    expect(useSduiCacheStore.getState().get('/documents/X/1')).toBeDefined()
  })

  it('«Не сохранять» для смонтированного экрана — интент, без прямого CLOSE транспортом', () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue({} as never)
    useSduiCacheStore.getState().save('/documents/X/1', cacheEntry(true))
    setMountedScreenRoute('/documents/X/1')

    discardTabSession('/documents/X/1', '/documents/X/1')

    expect(post).not.toHaveBeenCalled()
    expect(consumeDiscardDraftClose('/documents/X/1')).toBe(true)
  })

  it('«Не сохранять» для вкладки без кэша после F5: черновик снимается OPEN → CLOSE discardDraft', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValueOnce({ formSessionId: 'fs-new', revision: 1 } as never)
      .mockResolvedValueOnce({} as never)

    discardTabSession(
      '/documents/X/new?fi=inst-1',
      '/documents/X/new?fi=inst-1'
    )

    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledTimes(2)
    })
    expect(post.mock.calls[0][0]).toMatchObject({
      formSessionId: null,
      route: '/documents/X/new?fi=inst-1',
      action: { type: 'OPEN', formInstanceId: 'inst-1' },
    })
    expect(post.mock.calls[1][0]).toMatchObject({
      formSessionId: 'fs-new',
      action: { type: 'CLOSE', discardDraft: true },
    })
    expect(consumeDiscardDraftClose('/documents/X/new?fi=inst-1')).toBe(false)
  })

  it('без известного экземпляра формы черновик не ищется', async () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue({} as never)

    await discardClosedFormDraft('/documents/X/never-opened-777')

    expect(post).not.toHaveBeenCalled()
  })
})
