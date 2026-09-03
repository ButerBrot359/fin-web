import type { NavigateFunction } from 'react-router-dom'

import { notifyPanelTabClose } from '../panel-tab-close-registry'
import { forgetFormInstanceId } from './form-instance-id'
import { useFormCacheStore } from '../hooks/use-form-cache-store'
import { useWorkspaceTabsStore } from '../hooks/use-workspace-tabs-store'

// Закрытие workspace-вкладки без dirty-проверки: снятие кэша формы,
// уведомление владельца панели (SDUI → panel-store.remove) и активация
// соседней вкладки. Используется tab-bar-ом и chrome панельной вкладки
// (layout: «назад»/крестик на странице движений).
export function performTabClose(
  tabId: string,
  navigate: NavigateFunction
): void {
  const store = useWorkspaceTabsStore.getState()
  const tab = store.tabs.find((t) => t.id === tabId)
  if (!tab) return

  const isPanel = tab.pageType === 'sdui-panel'
  // У панельных вкладок нет кэша формы
  if (!isPanel) useFormCacheStore.getState().removeTab(tabId)
  // Вкладку закрыли — её экземпляр формы забыт: открытая заново форма создания получит новый
  // идентификатор и, значит, будет пустой (фронт-спека 03.09.2026 §5.1).
  forgetFormInstanceId(tab.path)

  const wasActive = store.activeTabId === tabId
  const closed = store.closeTab(tabId)
  if (isPanel && closed?.panelId) notifyPanelTabClose(closed.panelId)
  if (!wasActive) return

  const remaining = useWorkspaceTabsStore.getState()
  // .at(0) вместо [0]: тип честно допускает undefined (вкладок могло не остаться), и
  // проверка ниже перестаёт быть «всегда ложной» для линтера.
  const nextTab =
    remaining.tabs.find((t) => t.id === remaining.activeTabId) ??
    remaining.tabs.at(0)
  if (!nextTab) {
    void navigate('/')
    return
  }
  if (nextTab.pageType === 'sdui-panel') {
    // Панельная вкладка живёт вне роутера — активируем без навигации
    remaining.setActiveTab(nextTab.id)
    return
  }
  void navigate(nextTab.path + nextTab.search)
}
