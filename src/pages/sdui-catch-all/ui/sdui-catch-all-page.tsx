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
  // SCRUM-353: карточка записи регистра сведений (создание и правка).
  'REGISTER',
])

// Восстановление dirty-сессии из sdui-кэша (SduiScreen restore-ветка,
// src/features/sdui/ui/sdui-screen.tsx) не шлёт OPEN и не зовёт onTab — без
// сида serverKind остаётся null до следующей навигации, и карточка на
// начальном рендере рисуется без PageHeader/диалога несохранённых. Сидируем
// из workspace-таба текущего маршрута (id таба = pathname, см.
// activateOrCreate в use-workspace-tabs-store.ts): pageType таба однозначно
// говорит «карточный экран или нет» — точный serverKind (DOCUMENT vs
// DOCUMENT_NEW и т.п.) для showCardChrome не важен, обе метки из CARD_KINDS
// равнозначны.
function seedServerKind(
  pathname: string,
  tabs: { id: string; pageType: string }[]
): string | null {
  const tab = tabs.find((t) => t.id === pathname)
  if (tab?.pageType === 'document-entry') return 'DOCUMENT'
  if (tab?.pageType === 'dictionary-entry') return 'DICTIONARY'
  if (tab?.pageType === 'information-register-entry') return 'REGISTER'
  return null
}

export const SduiCatchAllPage: FC = () => {
  const location = useLocation()
  const [mode, setMode] = useState<Mode>({ kind: 'sdui' })
  const [serverKind, setServerKind] = useState<string | null>(() =>
    seedServerKind(location.pathname, useWorkspaceTabsStore.getState().tabs)
  )

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
