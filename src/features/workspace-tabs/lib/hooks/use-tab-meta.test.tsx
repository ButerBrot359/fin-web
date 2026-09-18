import type { ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'

import { useTabMeta } from './use-tab-meta'
import { useWorkspaceTabsStore } from './use-workspace-tabs-store'

const LIST = '/modules/ZarplatiIKadri/document/VedomostVyplatyZarabotnoyPlaty'
const OTHER = '/modules/ZarplatiIKadri/document/NachislenieZarplatySotrudnikam'

function wrapperAt(path: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<>{children}</>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  sessionStorage.clear()
  useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
})

describe('useTabMeta', () => {
  it('пишет заголовок во вкладку ТЕКУЩЕГО маршрута, а не в первую открытую', () => {
    const store = useWorkspaceTabsStore.getState()
    store.activateOrCreate(LIST, '', 'document-list')
    store.activateOrCreate(OTHER, '', 'document-list')

    renderHook(
      () => {
        useTabMeta('Начисление зарплаты сотрудникам')
      },
      {
        wrapper: wrapperAt(OTHER),
      }
    )

    const tabs = useWorkspaceTabsStore.getState().tabs
    expect(tabs.find((t) => t.id === OTHER)?.title).toBe(
      'Начисление зарплаты сотрудникам'
    )
    expect(tabs.find((t) => t.id === LIST)?.title).toBe('')
  })

  it('пустой заголовок не затирает имя уже названной вкладки', () => {
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(OTHER, '', 'document-list')
    useWorkspaceTabsStore.getState().setTabTitle(OTHER, 'Начисление зарплаты')

    renderHook(
      () => {
        useTabMeta('')
      },
      { wrapper: wrapperAt(OTHER) }
    )

    expect(
      useWorkspaceTabsStore.getState().tabs.find((t) => t.id === OTHER)?.title
    ).toBe('Начисление зарплаты')
  })

  // updateTabPath переносит id вкладки на новый путь, поэтому поиск по path
  // находит ту же вкладку и после записи документа.
  it('после записи нового документа (/new → /:id) заголовок остаётся в своей вкладке', () => {
    const newPath = `${OTHER}/new`
    const savedPath = `${OTHER}/12345`
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(newPath, '', 'document-entry')
    useWorkspaceTabsStore.getState().updateTabPath(newPath, savedPath, '')

    renderHook(
      () => {
        useTabMeta('Начисление зарплаты сотрудникам DEMO00-00020')
      },
      {
        wrapper: wrapperAt(savedPath),
      }
    )

    const tabs = useWorkspaceTabsStore.getState().tabs
    expect(tabs).toHaveLength(1)
    expect(tabs[0].id).toBe(savedPath)
    expect(tabs[0].title).toBe('Начисление зарплаты сотрудникам DEMO00-00020')
  })
})
