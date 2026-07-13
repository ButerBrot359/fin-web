import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode } from '../types/view'
import { PanelStateProvider } from './panel-state-provider'
import { useSduiSession } from './sdui-session-context'
import type { PanelEntry } from './stores/panel-store'

const panel: PanelEntry = {
  panelId: 'p-1',
  node: { id: 'root', type: 'VSTACK' } as ViewNode,
  presentation: 'modal',
  viewState: { 'doc.name': 'Счёт №5' },
}

const Probe = () => {
  const session = useSduiSession()
  return <div>{String(session.getValue('doc.name'))}</div>
}

const MutatingProbe = () => {
  const session = useSduiSession()
  session.setValue('doc.name', 'Другой')
  return null
}

describe('PanelStateProvider (childState-панель без сессии)', () => {
  afterEach(cleanup)

  it('биндинг читает seed-значение из viewState', () => {
    render(
      <PanelStateProvider panel={panel}>
        <Probe />
      </PanelStateProvider>,
    )
    expect(screen.getByText('Счёт №5')).toBeTruthy()
  })

  it('setValue — warn + noop, не бросает', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() =>
      render(
        <PanelStateProvider panel={panel}>
          <MutatingProbe />
        </PanelStateProvider>,
      ),
    ).not.toThrow()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
