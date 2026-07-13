import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewEffect } from '../types/view'
import { usePanelStore } from './stores/panel-store'
import { setWorkspaceTabGateway } from './workspace-tab-gateway'
import { openDialogAsPanel } from './open-dialog-panel'

const makeEffect = (overrides: Partial<ViewEffect> = {}): ViewEffect => ({
  type: 'openDialog',
  node: {
    id: 'dialog.movements',
    type: 'PAGE',
    props: {
      title: 'Движения документа: ПКО AAY00-00034',
      presentation: 'page',
      openInWorkspaceTab: true,
      tabKey: 'movements:27856464',
    },
  },
  childState: { 'movements.acc.Zhurnal': [{ id: 1 }] },
  ...overrides,
})

describe('openDialogAsPanel', () => {
  const openPanelTabMock = vi.fn()

  beforeEach(() => {
    usePanelStore.setState({ panels: [] })
    openPanelTabMock.mockClear()
    setWorkspaceTabGateway({ openPanelTab: openPanelTabMock })
  })

  afterEach(() => {
    setWorkspaceTabGateway(null)
  })

  it('openInWorkspaceTab: зовёт gateway и кладёт панель с tabKey', () => {
    openDialogAsPanel(makeEffect())

    expect(openPanelTabMock).toHaveBeenCalledWith({
      tabKey: 'movements:27856464',
      title: 'Движения документа: ПКО AAY00-00034',
      panelId: 'dialog.movements',
    })
    const panel = usePanelStore.getState().panels[0]
    expect(panel.openInWorkspaceTab).toBe(true)
    expect(panel.tabKey).toBe('movements:27856464')
    expect(panel.presentation).toBe('page')
    expect(panel.viewState).toEqual({ 'movements.acc.Zhurnal': [{ id: 1 }] })
    expect(panel.session).toBeUndefined()
  })

  it('повторное открытие того же tabKey заменяет панель, а не дублирует', () => {
    openDialogAsPanel(makeEffect())
    openDialogAsPanel(makeEffect({ childState: { fresh: [] } }))

    const panels = usePanelStore.getState().panels
    expect(panels).toHaveLength(1)
    expect(panels[0].viewState).toEqual({ fresh: [] })
  })

  it('с sessionId создаёт session c parentSessionId', () => {
    openDialogAsPanel(
      makeEffect({ sessionId: 'child-1', childRevision: 3 }),
      'parent-1',
    )

    expect(usePanelStore.getState().panels[0].session).toEqual({
      formSessionId: 'child-1',
      revision: 3,
      parentSessionId: 'parent-1',
      targetNodeId: undefined,
    })
  })

  it('без gateway панель падает в fallback без openInWorkspaceTab', () => {
    setWorkspaceTabGateway(null)

    openDialogAsPanel(makeEffect())

    const panel = usePanelStore.getState().panels[0]
    expect(panel.openInWorkspaceTab).toBeUndefined()
    expect(panel.tabKey).toBeUndefined()
  })
})
