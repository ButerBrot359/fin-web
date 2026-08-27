import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as SduiFeature from '@/features/sdui'

import { UniversalDomainEntryPage } from './universal-domain-entry-page'

// Гейтом управляет тест через window.__udNewView; SduiScreen может «провалить»
// OPEN (422) через window.__udOpenFails — как в sdui-catch-all-page.test
vi.mock('@/features/sdui', async (orig) => {
  const actual = await orig<typeof SduiFeature>()
  return {
    ...actual,
    SduiScreen: (props: { onOpenFailed?: () => void }) => {
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

const renderAt = () =>
  render(
    <MemoryRouter
      initialEntries={[
        '/modules/ZarplatiIKadri/calculationplan/VidyNachisleniyOrganizatsii/5?domain=CALCULATION_PLAN',
      ]}
    >
      <UniversalDomainEntryPage />
    </MemoryRouter>
  )

describe('UniversalDomainEntryPage (SCRUM-388)', () => {
  beforeEach(() => {
    ;(window as unknown as { __udNewView?: boolean }).__udNewView = true
    ;(window as unknown as { __udOpenFails?: boolean }).__udOpenFails = false
  })

  // Без globals в vitest.config RTL не чистит DOM сам — иначе рендеры копятся
  afterEach(cleanup)

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
