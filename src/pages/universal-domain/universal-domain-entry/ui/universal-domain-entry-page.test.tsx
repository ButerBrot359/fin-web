import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SduiFeature from '@/features/sdui'
import { useViewStateStore } from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { UniversalDomainEntryPage } from './universal-domain-entry-page'

/** Пропсы, которыми хост обвязывает SDUI-экран (см. мок ниже). */
const screenProps: {
  onSavedAndClosed?: (route: string) => void
  onDirtyChange?: (route: string, dirty: boolean) => void
  consumePendingAction?: (route: string) => string | null
} = {}

// Гейтом управляет тест через window.__udNewView; SduiScreen может «провалить»
// OPEN (422) через window.__udOpenFails — как в sdui-catch-all-page.test
vi.mock('@/features/sdui', async (orig) => {
  const actual = await orig<typeof SduiFeature>()
  return {
    ...actual,
    SduiScreen: (props: {
      onOpenFailed?: () => void
      onSavedAndClosed?: (route: string) => void
      onDirtyChange?: (route: string, dirty: boolean) => void
      consumePendingAction?: (route: string) => string | null
    }) => {
      Object.assign(screenProps, props)
      const fails = (window as unknown as { __udOpenFails?: boolean })
        .__udOpenFails
      if (fails) props.onOpenFailed?.()
      return <div>SDUI-КАРТОЧКА</div>
    },
  }
})

// PageHeader тянет svg-иконки data-URL, которые роняют jsdom — мокаем шапку
vi.mock('@/widgets/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => <div>{title}</div>,
}))

vi.mock('../../universal-domain-list', () => ({
  useUniversalDomainType: () => ({
    title: 'Виды начислений организации',
    attributes: [],
    newView: (window as unknown as { __udNewView?: boolean }).__udNewView,
    isLoading: false,
  }),
}))

const ROUTE =
  '/modules/ZarplatiIKadri/calculationplan/VidyNachisleniyOrganizatsii/5'

const renderAt = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[`${ROUTE}?domain=CALCULATION_PLAN`]}>
        <UniversalDomainEntryPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('UniversalDomainEntryPage (SCRUM-388)', () => {
  beforeEach(() => {
    ;(window as unknown as { __udNewView?: boolean }).__udNewView = true
    ;(window as unknown as { __udOpenFails?: boolean }).__udOpenFails = false
  })

  // Без globals в vitest.config RTL не чистит DOM сам — иначе рендеры копятся
  afterEach(() => {
    cleanup()
    act(() => {
      useViewStateStore.getState().setDirty(false)
    })
  })

  it('newView=true → монтирует SDUI-карточку', () => {
    renderAt()
    expect(screen.getByText('SDUI-КАРТОЧКА')).toBeTruthy()
  })

  it('newView=false → нейтральное сообщение вместо белого экрана, SDUI не монтируется', () => {
    ;(window as unknown as { __udNewView?: boolean }).__udNewView = false
    renderAt()
    expect(screen.queryByText('SDUI-КАРТОЧКА')).toBeNull()
    // Заголовок типа остаётся — пользователь понимает, где он
    expect(screen.getByText('Виды начислений организации')).toBeTruthy()
  })

  it('422 на OPEN (гейт бэка выключен) → нейтральное сообщение', () => {
    ;(window as unknown as { __udOpenFails?: boolean }).__udOpenFails = true
    renderAt()
    expect(screen.queryByText('SDUI-КАРТОЧКА')).toBeNull()
    expect(screen.getByText('Виды начислений организации')).toBeTruthy()
  })
})

// Карточка стала редактируемой (правки ПВР, 29.08.2026): сервер отдаёт тулбар с
// dict.save / dict.saveAndClose, и хост обязан дать SDUI-экрану обвязку записи.
// Без неё «Записать и закрыть» не закрывало вкладку, а «грязная» форма молча
// терялась при закрытии.
describe('UniversalDomainEntryPage — обвязка записи', () => {
  beforeEach(() => {
    ;(window as unknown as { __udNewView?: boolean }).__udNewView = true
    ;(window as unknown as { __udOpenFails?: boolean }).__udOpenFails = false
  })

  afterEach(() => {
    cleanup()
    act(() => {
      useViewStateStore.getState().setDirty(false)
    })
  })

  it('после save-and-close вкладка карточки закрывается', () => {
    useWorkspaceTabsStore.setState({
      tabs: [{ id: ROUTE, title: 'Оклад' }],
    } as unknown as ReturnType<typeof useWorkspaceTabsStore.getState>)

    renderAt()
    expect(screenProps.onSavedAndClosed).toBeTypeOf('function')

    act(() => {
      screenProps.onSavedAndClosed?.(ROUTE)
    })

    expect(
      useWorkspaceTabsStore.getState().tabs.some((tab) => tab.id === ROUTE)
    ).toBe(false)
  })

  it('отложенное действие панели вкладок и dirty-флаг прокинуты в экран', () => {
    renderAt()
    expect(screenProps.consumePendingAction).toBeTypeOf('function')
    expect(screenProps.onDirtyChange).toBeTypeOf('function')
  })

  it('несохранённые правки помечают заголовок звёздочкой', () => {
    renderAt()
    act(() => {
      useViewStateStore.getState().setDirty(true)
    })
    expect(screen.getByText(/\*$/)).toBeTruthy()
  })
})
