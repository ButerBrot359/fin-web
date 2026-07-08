import { afterEach, describe, expect, it, vi } from 'vitest'

import { openPanelTab, setWorkspaceTabGateway } from './workspace-tab-gateway'

describe('workspace-tab-gateway', () => {
  afterEach(() => setWorkspaceTabGateway(null))

  it('зовёт зарегистрированную реализацию и возвращает true', () => {
    const impl = { openPanelTab: vi.fn() }
    setWorkspaceTabGateway(impl)
    const params = { tabKey: 'movements:1', title: 'Движения', panelId: 'p1' }
    expect(openPanelTab(params)).toBe(true)
    expect(impl.openPanelTab).toHaveBeenCalledWith(params)
  })

  it('без реализации — warn и false (фолбэк на Dialog)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(openPanelTab({ tabKey: 'k', title: 't', panelId: 'p' })).toBe(false)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
