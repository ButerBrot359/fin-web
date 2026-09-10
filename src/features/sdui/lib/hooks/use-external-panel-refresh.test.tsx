import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { requestOpenViewsRefresh } from '@/shared/lib/refresh/open-views-refresh'

import { useExternalPanelRefresh } from './use-external-panel-refresh'
import { usePanelStore, type PanelEntry } from '../stores/panel-store'
import { fetchMovementsView } from '../../api/movements-api'
import type { ViewResponse } from '../../types/view'

vi.mock('../../api/movements-api', () => ({ fetchMovementsView: vi.fn() }))
afterEach(cleanup)
const panel: PanelEntry = {
  panelId: 'movements-42',
  node: { id: 'old', type: 'PAGE' },
  presentation: 'page',
  openInWorkspaceTab: true,
  tabKey: 'movements:42',
  viewState: { rows: [1] },
}

beforeEach(() => {
  vi.clearAllMocks()
  usePanelStore.setState({ panels: [panel] })
})

it('updates movement snapshots without creating or navigating tabs', async () => {
  vi.mocked(fetchMovementsView).mockResolvedValue({
    formSessionId: '',
    revision: 0,
    effects: [
      {
        type: 'openDialog',
        node: { id: 'new', type: 'PAGE', props: { tabKey: 'movements:42' } },
        childState: { rows: [2] },
      },
    ],
  })
  renderHook(() => {
    useExternalPanelRefresh()
  })
  await act(async () => {
    expect((await requestOpenViewsRefresh()).refreshed).toBe(1)
  })
  expect(fetchMovementsView).toHaveBeenCalledWith('42', 30000)
  expect(usePanelStore.getState().panels).toHaveLength(1)
  expect(usePanelStore.getState().panels[0].panelId).toBe('movements-42')
  expect(usePanelStore.getState().panels[0].viewState).toEqual({ rows: [2] })
})

it('replaces stale rows with the server notice after unposting', async () => {
  vi.mocked(fetchMovementsView).mockResolvedValue({
    formSessionId: '',
    revision: 0,
    effects: [{ type: 'notify', level: 'warning', message: 'Нет движений' }],
  })
  renderHook(() => {
    useExternalPanelRefresh()
  })
  await act(async () => {
    await requestOpenViewsRefresh()
  })
  expect(usePanelStore.getState().panels[0].viewState).toEqual({})
  expect(usePanelStore.getState().panels[0].refreshMessage).toBe('Нет движений')
})

it('does not resurrect a tab closed during refresh', async () => {
  let finish!: (value: ViewResponse) => void
  vi.mocked(fetchMovementsView).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  renderHook(() => {
    useExternalPanelRefresh()
  })
  const pending = requestOpenViewsRefresh()
  usePanelStore.getState().remove(panel.panelId)
  finish({
    formSessionId: '',
    revision: 0,
    effects: [{ type: 'notify', level: 'warning', message: 'Нет движений' }],
  })
  expect((await pending).deferred).toBe(1)
  expect(usePanelStore.getState().panels).toHaveLength(0)
})

it('keeps the prior snapshot and reports failure when the server cannot refresh', async () => {
  vi.mocked(fetchMovementsView).mockRejectedValue(new Error('Offline'))
  renderHook(() => {
    useExternalPanelRefresh()
  })
  expect((await requestOpenViewsRefresh()).failed).toBe(1)
  expect(usePanelStore.getState().panels[0]).toBe(panel)
})
