import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as SduiFeature from '@/features/sdui'
import { useViewStateStore, useTreeStore } from '@/features/sdui'
import {
  onTabSaveFailed,
  useFormCacheStore,
  useWorkspaceTabsStore,
} from '@/features/workspace-tabs'
import type { ViewNode } from '@/features/sdui'

import { SduiCardScreen } from './sdui-card-screen'

// Мутируемое состояние мока SduiScreen — через vi.hoisted, иначе TDZ на
// module-scope переменных при поднятии vi.mock (см. sdui-catch-all-page.test.tsx
// и universal-domain-entry-page.test.tsx — тот же класс проблемы решают через window).
const { screenState } = vi.hoisted(() => ({
  screenState: {
    mountCount: 0,
    renderCount: 0,
    lastProps: {} as {
      shouldPersistSession?: (route: string) => boolean
      pendingAction?: string | null
      onSaveAndCloseFailed?: (route: string) => void
    },
    reportTitle: '',
  },
}))

vi.mock('@/features/sdui', async (orig) => {
  const actual = await orig<typeof SduiFeature>()
  return {
    ...actual,
    SduiScreen: (props: {
      shouldPersistSession?: (route: string) => boolean
      onTitleChange?: (title: string) => void
    }) => {
      screenState.renderCount += 1
      screenState.lastProps = props
      useEffect(() => {
        screenState.mountCount += 1
      }, [])
      const { onTitleChange } = props
      useEffect(() => {
        if (screenState.reportTitle) onTitleChange?.(screenState.reportTitle)
      }, [onTitleChange])
      return <div>SDUI-ЭКРАН</div>
    },
  }
})

// PageHeader тянет svg-иконки data-URL, которые роняют jsdom — мокаем шапку
// (прецедент: universal-domain-entry-page.test.tsx)
vi.mock('@/widgets/page-header', () => ({
  PageHeader: ({ title, onClose }: { title: string; onClose?: () => void }) => (
    <div data-testid="page-header">
      {title}
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

const renderAt = (path: string, showCardChrome: boolean, showHeader = false) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <SduiCardScreen
          showCardChrome={showCardChrome}
          showHeader={showHeader}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )

/** Дерево экрана списка: PAGE с узлом LIST — по нему шапка и опознаёт список. */
const listTree: ViewNode = {
  id: 'list.RKO',
  type: 'PAGE',
  props: { title: 'Расходный кассовый ордер' },
  children: [{ id: 'list.RKO.list', type: 'LIST' } as ViewNode],
}

describe('SduiCardScreen', () => {
  afterEach(() => {
    cleanup()
    screenState.mountCount = 0
    screenState.renderCount = 0
    screenState.lastProps = {}
    screenState.reportTitle = ''
    act(() => {
      useViewStateStore.getState().replaceAll({})
      useTreeStore.getState().reset()
    })
  })

  it('карточный kind → есть PageHeader и один вызов рендера SduiScreen с непустым shouldPersistSession', () => {
    renderAt('/modules/kazna/document/RKO/5', true)
    expect(screen.getByTestId('page-header')).toBeTruthy()
    expect(screenState.renderCount).toBe(1)
    expect(screenState.lastProps.shouldPersistSession).toBeTypeOf('function')
  })

  it('без обвязки (ни карточной, ни списковой) → PageHeader отсутствует', () => {
    renderAt('/modules/kazna/document/RKO', false)
    expect(screen.getByText('SDUI-ЭКРАН')).toBeTruthy()
    expect(screen.queryByTestId('page-header')).toBeNull()
  })

  /**
   * У легаси-экрана списка есть шапка с названием, навигацией и крестиком «закрыть», а
   * SDUI-версия обходилась заголовком в теле страницы и вовсе без крестика (02.09.2026).
   * Список опознаётся по дереву, а не по kind вкладки: у списков регистров и плана счетов
   * kind тот же, что у их карточек.
   */
  it('дерево списка → PageHeader с заголовком, даже без карточной обвязки', () => {
    act(() => {
      useTreeStore.getState().setRoot(listTree)
    })

    renderAt('/modules/kazna/document/RKO', false)

    expect(screen.getByTestId('page-header')).toBeTruthy()
    expect(screen.getByText('Расходный кассовый ордер')).toBeTruthy()
  })

  it('дерево карточки (без узла LIST) и без карточной обвязки → шапки нет', () => {
    act(() => {
      useTreeStore.getState().setRoot({
        id: 'doc.RKO',
        type: 'PAGE',
        props: { title: 'РКО №5' },
        children: [{ id: 'doc.RKO.tabs', type: 'TABS' } as ViewNode],
      })
    })

    renderAt('/modules/kazna/document/RKO/5', false)

    expect(screen.queryByTestId('page-header')).toBeNull()
  })

  it('dirty=true → заголовок с « *»', () => {
    const root: ViewNode = {
      id: 'root',
      type: 'PAGE',
      props: { title: 'РКО №5' },
      children: [],
    }
    act(() => {
      useTreeStore.getState().setRoot(root)
    })
    act(() => {
      useViewStateStore.getState().set('any', 'x')
    })
    renderAt('/modules/kazna/document/RKO/5', true)
    expect(screen.getByText('РКО №5 *')).toBeTruthy()
  })

  it('отчёт (только шапка) с изменённым параметром → заголовок без « *», закрытие без диалога', () => {
    act(() => {
      useTreeStore.getState().setRoot({
        id: 'report',
        type: 'PAGE',
        props: { title: 'Оборотно-сальдовая ведомость' },
        children: [],
      })
    })
    act(() => {
      useViewStateStore.getState().set('report.Osv.param.Period', '2026-01-01')
    })

    renderAt(
      '/modules/Otchety/reportalt/OborotnoSaldovayaVedomost',
      false,
      true
    )

    expect(screen.getByText('Оборотно-сальдовая ведомость')).toBeTruthy()
    expect(screen.queryByText('Оборотно-сальдовая ведомость *')).toBeNull()
  })

  it('смена showCardChrome (list-kind → card-kind) НЕ размонтирует SduiScreen', () => {
    const client = new QueryClient()
    const { rerender } = render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/modules/kazna/document/RKO/5']}>
          <SduiCardScreen showCardChrome={false} />
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screenState.mountCount).toBe(1)

    rerender(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/modules/kazna/document/RKO/5']}>
          <SduiCardScreen showCardChrome={true} />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(screenState.mountCount).toBe(1)
    expect(screen.getByTestId('page-header')).toBeTruthy()
  })
})

describe('SduiCardScreen — заголовок вкладки', () => {
  afterEach(() => {
    cleanup()
    screenState.reportTitle = ''
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('заголовок формы создания уходит в свою вкладку, а не в соседнюю форму создания того же типа', () => {
    const path = '/modules/zarplata/document/BolnichnyyList/new'
    const store = useWorkspaceTabsStore.getState()
    const pervaya = store.activateOrCreate(path, '?fi=tab-1', 'document-entry')
    store.setTabTitle(pervaya!, 'Больничный лист (создание)')
    const vtoraya = store.activateOrCreate(path, '?fi=tab-2', 'document-entry')
    store.activateOrCreate(
      '/modules/zarplata/document/BolnichnyyList',
      '',
      'document-list'
    )
    screenState.reportTitle = 'Больничный лист DEMO00-00023'

    renderAt(`${path}?fi=tab-2`, true)

    const tabs = useWorkspaceTabsStore.getState().tabs
    expect(tabs.find((t) => t.id === pervaya)?.title).toBe(
      'Больничный лист (создание)'
    )
    expect(tabs.find((t) => t.id === vtoraya)?.title).toBe(
      'Больничный лист DEMO00-00023'
    )
  })
})

describe('SduiCardScreen — save-and-close из бара вкладок (D5/D11)', () => {
  afterEach(() => {
    cleanup()
    useFormCacheStore.setState({ cache: {}, pendingActions: {} })
  })

  it('pending save-and-close своей вкладки реактивно доходит до SduiScreen; неудача уведомляет бар', () => {
    const route = '/modules/kazna/document/RKO/5'
    renderAt(route, true)
    expect(screenState.lastProps.pendingAction).toBeNull()

    act(() => {
      useFormCacheStore.getState().setPendingAction(route, 'save-and-close')
    })
    expect(screenState.lastProps.pendingAction).toBe('save-and-close')

    const failed: string[] = []
    const off = onTabSaveFailed((id) => failed.push(id))
    screenState.lastProps.onSaveAndCloseFailed?.(route)
    expect(failed).toEqual([route])
    off()
  })
})

describe('SduiCardScreen — шапка формы отчёта', () => {
  afterEach(cleanup)

  it('showHeader рисует шапку без карточной обвязки', () => {
    renderAt(
      '/modules/Otchety/reportalt/OborotnoSaldovayaVedomost',
      false,
      true
    )

    expect(screen.getByTestId('page-header')).toBeTruthy()
  })

  it('без showHeader и карточной обвязки шапки нет', () => {
    renderAt('/modules/Otchety/reportalt/OborotnoSaldovayaVedomost', false)

    expect(screen.queryByTestId('page-header')).toBeNull()
  })
})
