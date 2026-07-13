import type { NavigateFunction } from 'react-router-dom'

import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'
import { performTabClose } from './perform-tab-close'

// «Назад» с панельной вкладки: активирует вкладку-опенер, панель ОСТАЁТСЯ
// в баре (повторный вход — кликом по вкладке). Опенер закрыт/не найден →
// fallback на закрытие панели: предсказуемый выход вместо мёртвой кнопки.
export function performTabBack(
  tabId: string,
  navigate: NavigateFunction,
): void {
  const store = useWorkspaceTabsStore.getState()
  const tab = store.tabs.find((t) => t.id === tabId)
  if (!tab) return

  const opener = tab.openerTabId
    ? store.tabs.find((t) => t.id === tab.openerTabId)
    : undefined
  if (!opener) {
    performTabClose(tabId, navigate)
    return
  }

  store.setActiveTab(opener.id)
  if (opener.pageType !== 'sdui-panel') {
    // Роутовая вкладка: роут под панелью не менялся — восстанавливаем URL
    void navigate(opener.path + opener.search)
  }
}
