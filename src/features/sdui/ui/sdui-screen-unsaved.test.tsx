import { act, cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ViewNode, ViewNodeAction } from '../types/view'
import { useSduiCacheStore } from '../lib/stores/sdui-cache-store'
import { useTreeStore } from '../lib/stores/tree-store'
import { useViewStateStore } from '../lib/stores/view-state-store'
import { SduiScreen } from './sdui-screen'

const { dispatchMock } = vi.hoisted(() => ({
  dispatchMock: vi.fn(() => Promise.resolve(true)),
}))

vi.mock('../lib/dispatch', () => ({
  useSduiDispatch: () => dispatchMock,
}))
vi.mock('../lib/hooks/use-session-heartbeat', () => ({
  useSessionHeartbeat: () => undefined,
}))
vi.mock('../lib/hooks/use-task-watcher', () => ({
  useTaskWatcher: () => undefined,
}))
vi.mock('../lib/hooks/use-external-view-refresh', () => ({
  useExternalViewRefresh: () => undefined,
}))
vi.mock('../lib/hooks/use-external-panel-refresh', () => ({
  useExternalPanelRefresh: () => undefined,
}))
vi.mock('../lib/hooks/use-form-save-hotkey', () => ({
  useFormSaveHotkey: () => undefined,
}))

const ROUTE = '/modules/zarplata/document/BolnichnyyList/new'
const SEARCH = '?fi=tab-1'
const KEY = `${ROUTE}${SEARCH}`

const tree: ViewNode = {
  id: 'doc.BL',
  type: 'PAGE',
  props: { title: 'Больничный лист (создание)' },
  children: [],
}

const saveDescriptor: ViewNodeAction = {
  trigger: 'click',
  actionId: 'save',
  command: 'save',
}

const renderScreen = (onDirtyChange = vi.fn()) => {
  const view = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[KEY]}>
        <SduiScreen
          shouldPersistSession={() => true}
          onDirtyChange={onDirtyChange}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { ...view, onDirtyChange }
}

const fillForm = () => {
  act(() => {
    useTreeStore.getState().setRoot(tree)
    useTreeStore.getState().setSession('fs-1', 3)
    useTreeStore.getState().setOnDirtyClose(saveDescriptor)
    useTreeStore.getState().setScreenKey('BolnichnyyList')
    useViewStateStore.getState().set('FizicheskoeLitso', { id: 4 })
    useViewStateStore.getState().setDirty(true)
  })
}

describe('SduiScreen: незаписанная форма при уходе с вкладки и перезагрузке', () => {
  beforeEach(() => {
    dispatchMock.mockClear()
  })

  afterEach(() => {
    cleanup()
    act(() => {
      useSduiCacheStore.getState().clear()
      useViewStateStore.getState().replaceAll({})
      useTreeStore.getState().reset()
    })
  })

  it('уход с изменённой вкладки не снимает с неё признак изменений', () => {
    const { unmount, onDirtyChange } = renderScreen()
    fillForm()
    onDirtyChange.mockClear()

    unmount()

    expect(onDirtyChange).not.toHaveBeenCalledWith(KEY, false)
    expect(useSduiCacheStore.getState().get(KEY)?.dirty).toBe(true)
    expect(dispatchMock).not.toHaveBeenCalledWith({ type: 'CLOSE' })
  })

  it('возврат на изменённую вкладку восстанавливает дескриптор сохранения', () => {
    const first = renderScreen()
    fillForm()
    first.unmount()

    renderScreen()

    expect(useTreeStore.getState().onDirtyClose).toEqual(saveDescriptor)
    expect(useTreeStore.getState().screenKey).toBe('BolnichnyyList')
    expect(useViewStateStore.getState().dirty).toBe(true)
  })

  it('чистая вкладка при уходе закрывает сессию и снимает признак изменений', () => {
    const { unmount, onDirtyChange } = renderScreen()
    act(() => {
      useTreeStore.getState().setRoot(tree)
    })

    unmount()

    expect(onDirtyChange).toHaveBeenCalledWith(KEY, false)
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'CLOSE' })
  })

  it('перезагрузка страницы с несохранёнными изменениями спрашивает подтверждение', () => {
    renderScreen()
    fillForm()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('перезагрузка без изменений проходит без подтверждения', () => {
    renderScreen()

    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(false)
  })
})
