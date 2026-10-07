import { useEffect } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import {
  MemoryRouter,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useValidationReportStore } from '@/entities/validation-report'

import type { ViewNode } from '../types/view'
import { requestScreenRebind } from '../lib/screen-rebind'
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
vi.mock('./validation/validation-report-host', () => ({
  ValidationReportHost: () => null,
}))

const TYPE_ROUTE = '/modules/zarplata/document/VedomostIspolnitelnyeListy'
const CREATE_KEY = `${TYPE_ROUTE}/new?fi=tab-1`
const RECORD_ROUTE = `${TYPE_ROUTE}/4`

const savedTree: ViewNode = {
  id: 'doc.VIL',
  type: 'PAGE',
  props: { title: 'Ведомость AAY00-00004 от 05.10.2026 12:20:17' },
  children: [],
}

const router: { navigate: NavigateFunction | null; path: string } = {
  navigate: null,
  path: '',
}

const RouterProbe = () => {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    router.navigate = navigate
    router.path = location.pathname + location.search
  })
  return null
}

const renderScreen = (onDirtyChange = vi.fn()) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[CREATE_KEY]}>
        <RouterProbe />
        <SduiScreen
          shouldPersistSession={() => true}
          onDirtyChange={onDirtyChange}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )
  return { onDirtyChange }
}

const go = (to: string, replace = false) => {
  act(() => {
    void router.navigate?.(to, { replace })
  })
}

const opens = () =>
  dispatchMock.mock.calls.filter(
    (call: unknown[]) => (call[0] as { type: string }).type === 'OPEN'
  ).length

describe('SduiScreen: форма создания после первой записи', () => {
  beforeEach(() => {
    dispatchMock.mockClear()
  })

  afterEach(() => {
    cleanup()
    act(() => {
      useSduiCacheStore.getState().clear()
      useViewStateStore.getState().replaceAll({})
      useTreeStore.getState().reset()
      useValidationReportStore.getState().clear(RECORD_ROUTE)
    })
  })

  it('переезжает на адрес документа без закрытия сессии и повторного открытия', () => {
    const { onDirtyChange } = renderScreen()
    act(() => {
      useTreeStore.getState().setRoot(savedTree)
      useTreeStore.getState().setSession('fs-1', 7)
      useViewStateStore.getState().set('Nomer', 'AAY00-00004')
      useValidationReportStore.getState().setReport(CREATE_KEY, {
        operation: 'post',
        blockingCount: 0,
        messages: [
          {
            id: 'w1',
            severity: 'WARNING',
            source: 'BUSINESS_RULE',
            blocking: false,
            message: 'Предупреждение проведения',
            target: null,
            attributeCode: null,
          },
        ],
      })
    })
    dispatchMock.mockClear()

    requestScreenRebind(CREATE_KEY, RECORD_ROUTE)
    go(RECORD_ROUTE, true)

    expect(router.path).toBe(RECORD_ROUTE)
    expect(dispatchMock).not.toHaveBeenCalled()
    expect(useTreeStore.getState().formSessionId).toBe('fs-1')
    expect(useTreeStore.getState().root).toBe(savedTree)
    expect(useViewStateStore.getState().state.Nomer).toBe('AAY00-00004')
    expect(onDirtyChange).toHaveBeenCalledWith(CREATE_KEY, false)
    expect(
      useValidationReportStore.getState().reports[RECORD_ROUTE].messages
    ).toHaveLength(1)
    expect(useValidationReportStore.getState().reports[CREATE_KEY]).toBe(
      undefined
    )
  })

  it('возврат на вкладку открывает записанный документ, а не пустую форму создания', () => {
    renderScreen()
    act(() => {
      useTreeStore.getState().setRoot(savedTree)
      useTreeStore.getState().setSession('fs-1', 7)
    })
    requestScreenRebind(CREATE_KEY, RECORD_ROUTE)
    go(RECORD_ROUTE, true)
    dispatchMock.mockClear()

    go(TYPE_ROUTE)
    expect(dispatchMock).toHaveBeenCalledWith({ type: 'CLOSE' })

    dispatchMock.mockClear()
    go(RECORD_ROUTE)

    expect(opens()).toBe(1)
    expect(router.path).toBe(RECORD_ROUTE)
  })

  it('незатребованная смена адреса по-прежнему закрывает и переоткрывает форму', () => {
    renderScreen()
    act(() => {
      useTreeStore.getState().setRoot(savedTree)
      useTreeStore.getState().setSession('fs-1', 7)
    })
    dispatchMock.mockClear()

    go(RECORD_ROUTE, true)

    expect(dispatchMock).toHaveBeenCalledWith({ type: 'CLOSE' })
    expect(opens()).toBe(1)
  })
})
