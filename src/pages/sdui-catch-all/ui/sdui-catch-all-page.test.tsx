import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type * as SduiFeature from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { SduiCatchAllPage } from './sdui-catch-all-page'

// Управляем исходом OPEN через мок SduiScreen
vi.mock('@/features/sdui', async (orig) => {
  const actual = await orig<typeof SduiFeature>()
  return {
    ...actual,
    SduiScreen: (props: {
      onRouteUnknown?: () => void
      onOpenFailed?: (i?: { kind?: string }) => void
    }) => {
      // тест переопределяет window.__catchAllCase и window.__catchAllKind
      const c = (window as unknown as { __catchAllCase?: string })
        .__catchAllCase
      if (c === 'route-unknown') props.onRouteUnknown?.()
      if (c === '422')
        props.onOpenFailed?.({
          kind: (window as unknown as { __catchAllKind?: string })
            .__catchAllKind,
        })
      return <div>SDUI-ДЕРЕВО</div>
    },
  }
})

vi.mock('./legacy-fallback', () => ({
  LegacyFallback: ({ kind }: { kind: string | null }) => (
    <div>ЛЕГАСИ:{kind}</div>
  ),
}))

// PageHeader тянет svg-иконки data-URL, которые роняют jsdom — мокаем шапку
// (прецедент: sdui-card-screen.test.tsx)
vi.mock('@/widgets/page-header', () => ({
  PageHeader: ({ title, onClose }: { title: string; onClose?: () => void }) => (
    <div data-testid="page-header">
      {title}
      <button onClick={onClose}>close</button>
    </div>
  ),
}))

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <SduiCatchAllPage />
      </MemoryRouter>
    </QueryClientProvider>
  )

describe('SduiCatchAllPage', () => {
  afterEach(() => {
    useWorkspaceTabsStore.setState({ tabs: [], activeTabId: null })
  })

  it('200 → рендерит SDUI-дерево', () => {
    ;(window as never as { __catchAllCase?: string }).__catchAllCase = 'ok'
    renderAt('/some/sdui/route')
    expect(screen.getByText('SDUI-ДЕРЕВО')).toBeTruthy()
  })

  it('422 → LegacyFallback с kind', () => {
    ;(window as never as { __catchAllCase?: string }).__catchAllCase = '422'
    ;(window as never as { __catchAllKind?: string }).__catchAllKind =
      'DOCUMENT_LIST'
    renderAt('/modules/kazna/document/RKO')
    expect(screen.getByText('ЛЕГАСИ:DOCUMENT_LIST')).toBeTruthy()
  })

  it.each(['DICTIONARY_LIST', 'REGISTER', 'ACCOUNT_PLAN', 'REPORT_ALT'])(
    '422 с kind=%s → LegacyFallback получает kind',
    (kind) => {
      ;(window as never as { __catchAllCase?: string }).__catchAllCase = '422'
      ;(window as never as { __catchAllKind?: string }).__catchAllKind = kind
      renderAt('/modules/x/whatever/y')
      expect(screen.getByText(`ЛЕГАСИ:${kind}`)).toBeTruthy()
    }
  )

  it('404 ROUTE_UNKNOWN → NotFound', () => {
    ;(window as never as { __catchAllCase?: string }).__catchAllCase =
      'route-unknown'
    renderAt('/foo/bar')
    expect(screen.getByText(/notFound|не найдена/i)).toBeTruthy()
  })

  it('restore dirty-сессии: вкладка document-entry для текущего пути → PageHeader сразу на initial mount, без вызова onTab (SduiScreen restore-ветка не шлёт OPEN)', () => {
    ;(window as never as { __catchAllCase?: string }).__catchAllCase = 'noop'
    const path = '/modules/kazna/document/RKO/5'
    useWorkspaceTabsStore.setState({
      tabs: [
        {
          id: path,
          path,
          search: '',
          title: '',
          pageType: 'document-entry',
          createdAt: Date.now(),
        },
      ],
      activeTabId: path,
    })
    renderAt(path)
    expect(screen.getByTestId('page-header')).toBeTruthy()
  })
})
