import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type * as SduiFeature from '@/features/sdui'
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

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <SduiCatchAllPage />
    </MemoryRouter>
  )

describe('SduiCatchAllPage', () => {
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
})
