import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../types/view'
import { viewTransport } from '../api/view-transport'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { useViewStateStore } from './stores/view-state-store'
import { closeAllSduiSessions, hasSduiUnsavedWork } from './language-session-control'

vi.mock('../api/view-transport', () => ({
  viewTransport: { post: vi.fn(), closeBeacon: vi.fn() },
}))

const node = { id: 'root', type: 'VSTACK', props: {}, children: [] } as unknown as ViewNode

const entry = (formSessionId: string | null, dirty: boolean) => ({
  root: node,
  formSessionId,
  revision: 1,
  viewState: {},
  dirty,
})

describe('hasSduiUnsavedWork', () => {
  beforeEach(() => {
    useSduiCacheStore.setState({ cache: {} })
    useViewStateStore.setState({ state: {}, dirty: false })
  })

  it('false, когда нет dirty ни в активной форме, ни в кэше', () => {
    useSduiCacheStore.getState().save('/a', entry('fs-1', false))
    expect(hasSduiUnsavedWork()).toBe(false)
  })

  it('true при dirty активной формы', () => {
    useViewStateStore.setState({ dirty: true })
    expect(hasSduiUnsavedWork()).toBe(true)
  })

  it('true при dirty-записи в кэше вкладок', () => {
    useSduiCacheStore.getState().save('/a', entry('fs-1', true))
    expect(hasSduiUnsavedWork()).toBe(true)
  })
})

describe('closeAllSduiSessions', () => {
  beforeEach(() => {
    vi.mocked(viewTransport.post).mockReset().mockResolvedValue({} as never)
    useSduiCacheStore.setState({ cache: {} })
  })

  it('шлёт CLOSE по каждой сессии кэша и очищает кэш', async () => {
    useSduiCacheStore.getState().save('/a', entry('fs-1', false))
    useSduiCacheStore.getState().save('/b', entry('fs-2', true))

    await closeAllSduiSessions()

    expect(viewTransport.post).toHaveBeenCalledTimes(2)
    expect(viewTransport.post).toHaveBeenCalledWith({
      formSessionId: 'fs-1',
      action: { type: 'CLOSE' },
    })
    expect(viewTransport.post).toHaveBeenCalledWith({
      formSessionId: 'fs-2',
      action: { type: 'CLOSE' },
    })
    expect(useSduiCacheStore.getState().cache).toEqual({})
  })

  it('пропускает записи без formSessionId', async () => {
    useSduiCacheStore.getState().save('/a', entry(null, false))
    await closeAllSduiSessions()
    expect(viewTransport.post).not.toHaveBeenCalled()
    expect(useSduiCacheStore.getState().cache).toEqual({})
  })

  it('ошибка CLOSE не мешает очистке (best-effort)', async () => {
    vi.mocked(viewTransport.post).mockRejectedValue(new Error('network'))
    useSduiCacheStore.getState().save('/a', entry('fs-1', false))
    await expect(closeAllSduiSessions()).resolves.toBeUndefined()
    expect(useSduiCacheStore.getState().cache).toEqual({})
  })
})
