import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { armNewTab, openPanelTab, usePanelStore } from '@/features/sdui'
import { viewTransport } from '@/features/sdui/api/view-transport'
import { useSduiCacheStore } from '@/features/sdui/lib/stores/sdui-cache-store'
import {
  notifyPanelTabClose,
  notifyTabDiscardClose,
  performTabClose,
  runAfterTabLeaveFlush,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'

import { useWorkspaceTabGatewayBinding } from './workspace-tab-binding'

describe('useWorkspaceTabGatewayBinding', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
    usePanelStore.setState({ panels: [] })
  })

  it('связывает openPanelTab SDUI с activateOrCreatePanel', () => {
    const { unmount } = renderHook(() => {
      useWorkspaceTabGatewayBinding()
    })

    const ok = openPanelTab({
      tabKey: 'movements:1',
      title: 'Движения',
      panelId: 'p1',
    })

    expect(ok).toBe(true)
    expect(useWorkspaceTabsStore.getState().tabs[0]).toMatchObject({
      id: 'movements:1',
      title: 'Движения',
      pageType: 'sdui-panel',
      panelId: 'p1',
    })
    unmount()
  })

  it('связывает armNewTab SDUI с флагом стора вкладок', () => {
    const { unmount } = renderHook(() => {
      useWorkspaceTabGatewayBinding()
    })

    expect(armNewTab()).toBe(true)
    expect(useWorkspaceTabsStore.getState().forceNewTab).toBe(true)

    useWorkspaceTabsStore.getState().consumeNewTab()
    unmount()
  })

  it('закрытие панельной вкладки удаляет панель из panel-store', () => {
    const { unmount } = renderHook(() => {
      useWorkspaceTabGatewayBinding()
    })
    usePanelStore.setState({
      panels: [
        {
          panelId: 'p1',
          node: { id: 'n', type: 'VSTACK' },
          presentation: 'page',
          viewState: {},
        },
      ],
    })

    notifyPanelTabClose('p1')

    expect(usePanelStore.getState().panels).toHaveLength(0)
    unmount()
  })

  it('после unmount гейтвей отвязан (openPanelTab → false)', () => {
    const { unmount } = renderHook(() => {
      useWorkspaceTabGatewayBinding()
    })
    unmount()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(
      openPanelTab({ tabKey: 'movements:2', title: 'Движения', panelId: 'p2' })
    ).toBe(false)
    warn.mockRestore()
  })
})

describe('useWorkspaceTabGatewayBinding: закрытые вкладки и flush (D7/D12)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
    useSduiCacheStore.setState({ cache: {} })
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  })

  const docTab = (id: string) => ({
    id,
    path: id,
    search: '',
    title: id,
    pageType: 'document-entry' as const,
    createdAt: 1,
  })

  it('закрытие неактивной чистой вкладки снимает её SDUI-кэш и закрывает сессию', () => {
    const post = vi.spyOn(viewTransport, 'post').mockResolvedValue({} as never)
    const { unmount } = renderHook(() => {
      useWorkspaceTabGatewayBinding()
    })
    useWorkspaceTabsStore.setState({
      tabs: [docTab('/documents/A/1'), docTab('/documents/A/2')],
      activeTabId: '/documents/A/1',
    })
    useSduiCacheStore.getState().save('/documents/A/2', {
      root: { id: 'r', type: 'PAGE' } as never,
      formSessionId: 'fs-2',
      revision: 4,
      viewState: {},
      dirty: false,
    })

    performTabClose('/documents/A/2', vi.fn())

    expect(useSduiCacheStore.getState().get('/documents/A/2')).toBeUndefined()
    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        formSessionId: 'fs-2',
        action: { type: 'CLOSE' },
      })
    )
    unmount()
  })

  it('«Не сохранять» неоткрытой после F5 вкладки снимает черновик по полному маршруту', async () => {
    const post = vi
      .spyOn(viewTransport, 'post')
      .mockResolvedValueOnce({ formSessionId: 'fs-d', revision: 1 } as never)
      .mockResolvedValue({} as never)
    const { unmount } = renderHook(() => {
      useWorkspaceTabGatewayBinding()
    })
    useWorkspaceTabsStore.setState({
      tabs: [
        docTab('/documents/A/1'),
        {
          ...docTab('/documents/A/new?fi=f-9'),
          path: '/documents/A/new',
          search: '?fi=f-9',
        },
      ],
      activeTabId: '/documents/A/1',
    })

    notifyTabDiscardClose('/documents/A/new?fi=f-9')
    performTabClose('/documents/A/new?fi=f-9', vi.fn())

    await vi.waitFor(() => {
      expect(post).toHaveBeenCalledWith(
        expect.objectContaining({
          formSessionId: 'fs-d',
          action: { type: 'CLOSE', discardDraft: true },
        })
      )
    })
    expect(post.mock.calls[0][0]).toMatchObject({
      route: '/documents/A/new?fi=f-9',
      action: { type: 'OPEN', formInstanceId: 'f-9' },
    })
    unmount()
  })

  it('регистрирует SDUI-flush правок перед уходом с вкладки', () => {
    const { unmount } = renderHook(() => {
      useWorkspaceTabGatewayBinding()
    })
    const action = vi.fn()
    runAfterTabLeaveFlush(action)
    expect(action).toHaveBeenCalledOnce()
    unmount()
  })
})
