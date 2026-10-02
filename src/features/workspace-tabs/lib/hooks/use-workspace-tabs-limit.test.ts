import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MAX_TABS } from '../consts/workspace-tabs-config'
import { onPanelTabClose } from '../panel-tab-close-registry'
import type { WorkspaceTab } from '../../types/workspace-tab'
import { useFormCacheStore } from './use-form-cache-store'
import { useWorkspaceTabsStore } from './use-workspace-tabs-store'

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/shared/ui/toast/show-toast', () => ({ showToast: toast }))
vi.mock('i18next', () => ({ default: { t: (key: string) => key } }))

const fill = (count: number): WorkspaceTab[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `/documents/${String(i)}`,
    path: `/documents/${String(i)}`,
    search: '',
    title: `Документ ${String(i)}`,
    pageType: 'document-entry',
    createdAt: i,
  }))

const ids = () => useWorkspaceTabsStore.getState().tabs.map((t) => t.id)

describe('лимит вкладок MAX_TABS (D9)', () => {
  beforeEach(() => {
    sessionStorage.clear()
    toast.mockReset()
    useFormCacheStore.setState({ cache: {}, pendingActions: {} })
    useWorkspaceTabsStore.setState({
      tabs: fill(MAX_TABS),
      activeTabId: `/documents/${String(MAX_TABS - 1)}`,
      activationOrder: [],
    })
  })

  it('вытесняется самая старая неизменённая вкладка, изменённые остаются', () => {
    useFormCacheStore.getState().setDirty('/documents/1', true)
    useFormCacheStore.getState().setDirty('/documents/2', true)

    const id = useWorkspaceTabsStore
      .getState()
      .activateOrCreate('/documents/new-one', '', 'document-entry')

    expect(id).toBe('/documents/new-one')
    expect(ids()).toHaveLength(MAX_TABS)
    expect(ids()).toContain('/documents/0')
    expect(ids()).toContain('/documents/1')
    expect(ids()).toContain('/documents/2')
    expect(ids()).not.toContain('/documents/3')
    expect(toast).not.toHaveBeenCalled()
  })

  it('без изменений сохраняется прежнее поведение: первая вкладка живёт, уходит вторая', () => {
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate('/documents/new-one', '', 'document-entry')

    expect(ids()[0]).toBe('/documents/0')
    expect(ids()).not.toContain('/documents/1')
  })

  it('все вкладки изменены — новая не открывается, показывается предупреждение', () => {
    for (const id of ids()) useFormCacheStore.getState().setDirty(id, true)

    const id = useWorkspaceTabsStore
      .getState()
      .activateOrCreate('/documents/new-one', '', 'document-entry')

    expect(id).toBeNull()
    expect(ids()).toEqual(fill(MAX_TABS).map((t) => t.id))
    expect(useWorkspaceTabsStore.getState().activeTabId).toBe(
      `/documents/${String(MAX_TABS - 1)}`
    )
    expect(toast).toHaveBeenCalledWith('warning', 'workspaceTabs.limitAllDirty')
  })

  it('панель при переполнении изменёнными не открывается и снимается у владельца', () => {
    for (const id of ids()) useFormCacheStore.getState().setDirty(id, true)
    const closed = vi.fn()
    const off = onPanelTabClose(closed)

    useWorkspaceTabsStore
      .getState()
      .activateOrCreatePanel('movements:1', 'Движения', 'p-1')

    expect(ids()).not.toContain('movements:1')
    expect(closed).toHaveBeenCalledWith('p-1')
    expect(toast).toHaveBeenCalledOnce()
    off()
  })

  it('вытесненная вкладка снимает свой кэш формы', () => {
    useFormCacheStore.getState().setCachedValues('/documents/1', { a: 1 })
    useFormCacheStore.getState().setDirty('/documents/1', false)

    useWorkspaceTabsStore
      .getState()
      .activateOrCreate('/documents/new-one', '', 'document-entry')

    expect(useFormCacheStore.getState().cache['/documents/1']).toBeUndefined()
  })
})
