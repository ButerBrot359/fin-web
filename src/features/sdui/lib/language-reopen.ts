import type { ViewAction, ViewTabMeta } from '../types/view'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { usePanelStore } from './stores/panel-store'
import { useTreeStore } from './stores/tree-store'

interface LanguageReopenDeps {
  dispatch: (
    action: ViewAction,
    behavior?: null,
    isRetry?: boolean,
    opts?: { onOpenTab?: (tab: ViewTabMeta | null) => void }
  ) => Promise<boolean>
  route: string
  layoutCode?: string
  onOpenTab?: (tab: ViewTabMeta | null) => void
}

// Смена языка = новая form-session: бэк фиксирует язык один раз на OPEN
// (SCRUM-268). CLOSE старой сессии (не плодим сирот на сервере) → сброс
// сторов → OPEN; новый language уйдёт автоматически из view-transport.
export async function reopenFormForLanguageChange({
  dispatch,
  route,
  layoutCode,
  onOpenTab,
}: LanguageReopenDeps): Promise<void> {
  await dispatch({ type: 'CLOSE' })
  useSduiCacheStore.getState().remove(route)
  usePanelStore.getState().reset()
  useTreeStore.getState().reset()
  if (onOpenTab) {
    await dispatch({ type: 'OPEN', layoutCode }, null, false, { onOpenTab })
    return
  }
  await dispatch({ type: 'OPEN', layoutCode })
}
