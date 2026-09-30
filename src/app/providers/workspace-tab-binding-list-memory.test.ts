import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useListMemoryStore } from '@/features/sdui/lib/stores/list-memory-store'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { useWorkspaceTabGatewayBinding } from './workspace-tab-binding'

describe('useWorkspaceTabGatewayBinding — память списков', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
    useListMemoryStore.setState({ entries: {} })
  })

  it('закрытие вкладки списка забывает его поиск, соседние вкладки не трогает', () => {
    const { unmount } = renderHook(() => {
      useWorkspaceTabGatewayBinding()
    })
    const tabs = useWorkspaceTabsStore.getState()
    tabs.activateOrCreate('/modules/a/dictionary/A', '', 'dictionary-list')
    tabs.activateOrCreate('/modules/b/dictionary/B', '', 'dictionary-list')
    const memory = { search: '341', selectedRowId: 1, trail: [] }
    const lists = useListMemoryStore.getState()
    lists.save('/modules/a/dictionary/A', 'lst', memory)
    lists.save('/modules/b/dictionary/B', 'lst', memory)

    useWorkspaceTabsStore.getState().closeTab('/modules/a/dictionary/A')

    const after = useListMemoryStore.getState()
    expect(after.get('/modules/a/dictionary/A', 'lst')).toBeUndefined()
    expect(after.get('/modules/b/dictionary/B', 'lst')).toEqual(memory)
    unmount()
  })
})
