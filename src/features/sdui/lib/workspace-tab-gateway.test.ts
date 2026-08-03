import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  armNewTab,
  openPanelTab,
  setWorkspaceTabGateway,
} from './workspace-tab-gateway'

describe('workspace-tab-gateway', () => {
  afterEach(() => setWorkspaceTabGateway(null))

  it('зовёт зарегистрированную реализацию и возвращает true', () => {
    const impl = { openPanelTab: vi.fn(), armNewTab: vi.fn() }
    setWorkspaceTabGateway(impl)
    const params = { tabKey: 'movements:1', title: 'Движения', panelId: 'p1' }
    expect(openPanelTab(params)).toBe(true)
    expect(impl.openPanelTab).toHaveBeenCalledWith(params)
  })

  it('без реализации — warn и false (фолбэк на Dialog)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(openPanelTab({ tabKey: 'k', title: 't', panelId: 'p' })).toBe(false)
    // armNewTab без impl — тоже false: переход состоится, но в текущей вкладке
    expect(armNewTab()).toBe(false)
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('armNewTab зовёт реализацию', () => {
    const impl = { openPanelTab: vi.fn(), armNewTab: vi.fn() }
    setWorkspaceTabGateway(impl)
    expect(armNewTab()).toBe(true)
    expect(impl.armNewTab).toHaveBeenCalledTimes(1)
  })
})
