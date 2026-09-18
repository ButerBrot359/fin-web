import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requestOpenViewsRefresh } from '@/shared/lib/refresh/open-views-refresh'

import { useExternalViewRefresh } from './use-external-view-refresh'
import { useTreeStore } from '../stores/tree-store'
import { useViewStateStore } from '../stores/view-state-store'
import { useSduiCacheStore } from '../stores/sdui-cache-store'
import { usePanelStore } from '../stores/panel-store'
import { useCommandInflightStore } from '../stores/command-inflight-store'
import {
  registerPendingFlush,
  unregisterPendingFlush,
} from '../pending-table-commits'
import { viewTransport } from '../../api/view-transport'
import type { useSduiDispatch } from '../dispatch'
import type { ViewNode } from '../../types/view'

vi.mock('../../api/view-transport', () => ({
  viewTransport: { post: vi.fn().mockResolvedValue({}) },
}))

type Dispatch = ReturnType<typeof useSduiDispatch>
afterEach(cleanup)
const root: ViewNode = { id: 'old', type: 'PAGE' }
const fresh: ViewNode = { id: 'fresh', type: 'PAGE' }

function successfulDispatch() {
  return vi
    .fn<Dispatch>()
    .mockImplementation((_action, _behavior, _retry, options) => {
      if (options?.acceptOpenResponse?.() === false)
        return Promise.resolve(false)
      useTreeStore.getState().setRoot(fresh)
      useTreeStore.getState().setSession('new-session', 1)
      useViewStateStore.getState().replaceAll({ amount: 500 })
      return Promise.resolve(true)
    })
}

beforeEach(() => {
  vi.clearAllMocks()
  useTreeStore.getState().reset()
  useTreeStore.getState().setRoot(root)
  useTreeStore.getState().setSession('old-session', 2)
  useViewStateStore.getState().replaceAll({ amount: 100 })
  useSduiCacheStore.getState().clear()
  usePanelStore.setState({ panels: [] })
  useCommandInflightStore.setState({ sessions: {} })
})

describe('external SDUI refresh', () => {
  it('reopens a clean active form, applies new state, and closes its old session', async () => {
    const dispatch = successfulDispatch()
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', dispatch)
    })
    let result
    await act(async () => {
      result = await requestOpenViewsRefresh()
    })

    expect(result).toEqual({ refreshed: 1, deferred: 0, failed: 0 })
    expect(dispatch).toHaveBeenCalledWith(
      { type: 'OPEN' },
      null,
      false,
      expect.objectContaining({ freshOpen: true })
    )
    expect(useTreeStore.getState().root).toBe(fresh)
    expect(useViewStateStore.getState().state.amount).toBe(500)
    expect(viewTransport.post).toHaveBeenCalledWith({
      formSessionId: 'old-session',
      action: { type: 'CLOSE' },
    })
  })

  it('preserves unsaved input without opening or closing a session', async () => {
    useViewStateStore.getState().set('amount', 200)
    const dispatch = successfulDispatch()
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', dispatch)
    })

    expect(await requestOpenViewsRefresh()).toEqual({
      refreshed: 0,
      deferred: 1,
      failed: 0,
    })
    expect(dispatch).not.toHaveBeenCalled()
    expect(viewTransport.post).not.toHaveBeenCalled()
    expect(useViewStateStore.getState().state.amount).toBe(200)
  })

  it('preserves table-cell input that has not reached the form state', async () => {
    const token = registerPendingFlush(
      () => Promise.resolve(),
      () => true
    )
    try {
      const dispatch = successfulDispatch()
      renderHook(() => {
        useExternalViewRefresh('/documents/Test/1', dispatch)
      })
      expect((await requestOpenViewsRefresh()).deferred).toBe(1)
      expect(dispatch).not.toHaveBeenCalled()
    } finally {
      unregisterPendingFlush(token)
    }
  })

  it('defers while a command or child editor is open', async () => {
    useCommandInflightStore.getState().begin('old-session')
    const dispatch = successfulDispatch()
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', dispatch)
    })
    expect((await requestOpenViewsRefresh()).deferred).toBe(1)
    useCommandInflightStore.getState().end('old-session')
    usePanelStore.getState().push({
      panelId: 'editor',
      node: root,
      presentation: 'modal',
      viewState: {},
    })
    expect((await requestOpenViewsRefresh()).deferred).toBe(1)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('drops clean cached forms but preserves dirty hidden tabs', async () => {
    const snapshot = {
      root,
      formSessionId: 'hidden',
      revision: 1,
      viewState: { amount: 300 },
      dirty: false,
    }
    useSduiCacheStore.getState().save('/clean', snapshot)
    useSduiCacheStore
      .getState()
      .save('/dirty', { ...snapshot, formSessionId: 'dirty', dirty: true })
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', successfulDispatch())
    })
    await act(async () => {
      expect((await requestOpenViewsRefresh()).deferred).toBe(1)
    })
    expect(useSduiCacheStore.getState().get('/clean')).toBeUndefined()
    expect(useSduiCacheStore.getState().get('/dirty')?.viewState.amount).toBe(
      300
    )
    expect(viewTransport.post).not.toHaveBeenCalledWith(
      expect.objectContaining({ formSessionId: 'dirty' })
    )
  })

  it.each(['edit', 'navigate', 'revision'] as const)(
    'rejects a late OPEN after %s',
    async (change) => {
      let finish!: () => void
      const dispatch = vi.fn<Dispatch>().mockImplementation(
        (_a, _b, _r, opts) =>
          new Promise((resolve) => {
            finish = () => {
              resolve(opts?.acceptOpenResponse?.() ?? true)
            }
          })
      )
      const { unmount } = renderHook(() => {
        useExternalViewRefresh('/documents/Test/1', dispatch)
      })
      const pending = requestOpenViewsRefresh()
      if (change === 'edit') useViewStateStore.getState().set('amount', 250)
      if (change === 'navigate') unmount()
      if (change === 'revision') useTreeStore.getState().bumpRevision(3)
      finish()
      expect((await pending).deferred).toBe(1)
      expect(useTreeStore.getState().root).toBe(root)
      expect(viewTransport.post).not.toHaveBeenCalled()
    }
  )

  it('keeps the old tree if OPEN fails', async () => {
    const dispatch = vi.fn<Dispatch>().mockResolvedValue(false)
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', dispatch)
    })
    expect((await requestOpenViewsRefresh()).failed).toBe(1)
    expect(useTreeStore.getState().root).toBe(root)
    expect(viewTransport.post).not.toHaveBeenCalled()
  })

  it('refreshes a deferred dirty form once the user saves or discards changes', async () => {
    useViewStateStore.getState().set('amount', 200)
    const dispatch = successfulDispatch()
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', dispatch)
    })
    expect((await requestOpenViewsRefresh()).deferred).toBe(1)
    expect(dispatch).not.toHaveBeenCalled()

    await act(async () => {
      useViewStateStore.getState().resetDirty()
      await Promise.resolve()
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(useViewStateStore.getState().state.amount).toBe(500)
  })

  it('waits for an in-flight command before refreshing once', async () => {
    useCommandInflightStore.getState().begin('old-session')
    const dispatch = successfulDispatch()
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', dispatch)
    })
    expect((await requestOpenViewsRefresh()).deferred).toBe(1)
    await act(async () => {
      useCommandInflightStore.getState().end('old-session')
      await Promise.resolve()
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('queues refresh while the first OPEN is loading', async () => {
    useTreeStore.getState().reset()
    const dispatch = successfulDispatch()
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', dispatch)
    })
    expect((await requestOpenViewsRefresh()).deferred).toBe(1)
    await act(async () => {
      useTreeStore.getState().setRoot(root)
      useTreeStore.getState().setSession('old-session', 2)
      await Promise.resolve()
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })

  it('does not retry a failed refresh on later unrelated state changes', async () => {
    const dispatch = vi.fn<Dispatch>().mockResolvedValue(false)
    renderHook(() => {
      useExternalViewRefresh('/documents/Test/1', dispatch)
    })
    expect((await requestOpenViewsRefresh()).failed).toBe(1)
    await act(async () => {
      useViewStateStore.getState().setFromServer('amount', 105)
      await Promise.resolve()
    })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
})
