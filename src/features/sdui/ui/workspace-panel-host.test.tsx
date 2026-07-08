import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePanelStore, type PanelEntry } from '../lib/stores/panel-store'
import { WorkspacePanelHost } from './workspace-panel-host'

vi.mock('./node-renderer', () => ({
  NodeRenderer: ({ node }: { node: { id: string } }) => <div>{node.id}</div>,
}))

const makePanel = (panelId: string): PanelEntry => ({
  panelId,
  node: { id: 'root.movements', type: 'VSTACK' },
  presentation: 'page',
  viewState: {},
  openInWorkspaceTab: true,
  tabKey: 'movements:42',
})

describe('WorkspacePanelHost', () => {
  beforeEach(() => {
    usePanelStore.setState({ panels: [] })
  })
  afterEach(cleanup)

  it('рендерит дерево панели по panelId', () => {
    usePanelStore.setState({ panels: [makePanel('p-1')] })
    render(<WorkspacePanelHost panelId="p-1" />)
    expect(screen.getByText('root.movements')).toBeTruthy()
  })

  it('рендерит null, если панели нет в сторе', () => {
    const { container } = render(<WorkspacePanelHost panelId="missing" />)
    expect(container.firstChild).toBeNull()
  })
})
