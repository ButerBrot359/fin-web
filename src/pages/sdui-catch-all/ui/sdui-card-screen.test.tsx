import { act, cleanup, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as SduiFeature from '@/features/sdui'
import { useViewStateStore, useTreeStore } from '@/features/sdui'
import type { ViewNode } from '@/features/sdui'

import { SduiCardScreen } from './sdui-card-screen'

// Мутируемое состояние мока SduiScreen — через vi.hoisted, иначе TDZ на
// module-scope переменных при поднятии vi.mock (см. sdui-catch-all-page.test.tsx
// и universal-domain-entry-page.test.tsx — тот же класс проблемы решают через window).
const { screenState } = vi.hoisted(() => ({
  screenState: {
    mountCount: 0,
    renderCount: 0,
    lastProps: {} as { shouldPersistSession?: (route: string) => boolean },
  },
}))

vi.mock('@/features/sdui', async (orig) => {
  const actual = await orig<typeof SduiFeature>()
  return {
    ...actual,
    SduiScreen: (props: {
      shouldPersistSession?: (route: string) => boolean
    }) => {
      screenState.renderCount += 1
      screenState.lastProps = props
      useEffect(() => {
        screenState.mountCount += 1
      }, [])
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

const renderAt = (
  path: string,
  showCardChrome: boolean,
  showListChrome = false
) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <SduiCardScreen
          showCardChrome={showCardChrome}
          showListChrome={showListChrome}
        />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('SduiCardScreen', () => {
  afterEach(() => {
    cleanup()
    screenState.mountCount = 0
    screenState.renderCount = 0
    screenState.lastProps = {}
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
   * У экрана списка легаси-версия имеет крестик «закрыть страницу», а SDUI-версия
   * осталась без него (02.09.2026). Шапку списку даём ту же, но БЕЗ заголовка:
   * заголовок у списка уже есть в самом дереве (LABEL), и в шапке он бы удвоился.
   */
  it('list-kind → PageHeader есть (крестик), заголовок в шапке не дублируется', () => {
    const root: ViewNode = {
      id: 'list.RKO',
      type: 'PAGE',
      props: { title: 'Расходный кассовый ордер' },
      children: [],
    }
    act(() => {
      useTreeStore.getState().setRoot(root)
    })

    renderAt('/modules/kazna/document/RKO', false, true)

    expect(screen.getByTestId('page-header')).toBeTruthy()
    expect(screen.queryByText('Расходный кассовый ордер')).toBeNull()
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
