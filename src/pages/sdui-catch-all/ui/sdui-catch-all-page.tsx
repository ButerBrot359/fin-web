import { useState, type FC } from 'react'
import { useLocation } from 'react-router-dom'

import { mapKindToPageType } from '@/features/sdui'
import type { ViewTabMeta } from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'

import { NotFound } from '@/shared/ui/not-found/not-found'

import { LegacyFallback } from './legacy-fallback'
import { SduiCardScreen } from './sdui-card-screen'

type Mode =
  | { kind: 'sdui' }
  | { kind: 'legacy'; screenKind: string | null }
  | { kind: 'not-found' }

// Виды экрана с карточной обвязкой (PageHeader, dirty-«*», диалог несохранённых,
// SCRUM-360 этап B) — совпадает с покрытием mapKindToPageType в tab-kind.ts.
const CARD_KINDS = new Set([
  'DOCUMENT',
  'DOCUMENT_NEW',
  'DICTIONARY',
  'DICTIONARY_NEW',
])

export const SduiCatchAllPage: FC = () => {
  const location = useLocation()
  const [mode, setMode] = useState<Mode>({ kind: 'sdui' })
  const [serverKind, setServerKind] = useState<string | null>(null)

  const authorTab = (tab: ViewTabMeta | null) => {
    setServerKind(tab?.kind ?? null)
    if (!tab) return
    const pageType = mapKindToPageType(tab.kind)
    if (!pageType) return
    useWorkspaceTabsStore
      .getState()
      .activateOrCreate(location.pathname, location.search, pageType)
  }

  if (mode.kind === 'not-found') return <NotFound />
  if (mode.kind === 'legacy') return <LegacyFallback kind={mode.screenKind} />

  return (
    <SduiCardScreen
      showCardChrome={serverKind !== null && CARD_KINDS.has(serverKind)}
      onTab={authorTab}
      onOpenFailed={(info) => {
        setMode({ kind: 'legacy', screenKind: info?.kind ?? null })
      }}
      onRouteUnknown={() => {
        setMode({ kind: 'not-found' })
      }}
    />
  )
}
