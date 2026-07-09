import type { ViewAction } from '../types/view'
import { useSduiCacheStore } from './stores/sdui-cache-store'
import { usePanelStore } from './stores/panel-store'
import { useTreeStore } from './stores/tree-store'

interface LanguageReopenDeps {
  dispatch: (action: ViewAction) => Promise<boolean>
  route: string
  layoutCode?: string
}

// Смена языка = новая form-session: бэк фиксирует язык один раз на OPEN
// (SCRUM-268). CLOSE старой сессии (не плодим сирот на сервере) → сброс
// сторов → OPEN; новый language уйдёт автоматически из view-transport.
export async function reopenFormForLanguageChange({
  dispatch,
  route,
  layoutCode,
}: LanguageReopenDeps): Promise<void> {
  await dispatch({ type: 'CLOSE' })
  useSduiCacheStore.getState().remove(route)
  usePanelStore.getState().reset()
  useTreeStore.getState().reset()
  await dispatch({ type: 'OPEN', layoutCode })
}
