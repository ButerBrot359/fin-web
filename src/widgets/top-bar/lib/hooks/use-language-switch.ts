import i18next from 'i18next'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  closeAllSduiSessions,
  hasSduiUnsavedWork,
  refreshTabTitles,
} from '@/features/sdui'
import { useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { ensureUiTranslations } from '@/shared/lib/i18n'

// Оркестрация переключения РУС/ҚАЗ (SCRUM-268): язык SDUI-формы фиксируется
// в form-session на OPEN, поэтому смена языка = CLOSE всех сессий + re-OPEN.
export function useLanguageSwitch() {
  const { i18n } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const performSwitch = async () => {
    setConfirmOpen(false)
    const nextLang = i18n.language === 'ru' ? 'kz' : 'ru'
    // Порядок критичен: CLOSE сессий и очистка кэша ДО changeLanguage —
    // иначе restore-ветка sdui-screen воскресит сессию на старом языке
    await closeAllSduiSessions()
    if (nextLang === 'kz') await ensureUiTranslations()
    await i18n.changeLanguage(nextLang)
    await refreshInactiveTabTitles(nextLang)
  }

  const refreshInactiveTabTitles = (lang: string) => {
    const { tabs, activeTabId } = useWorkspaceTabsStore.getState()
    const targets = tabs.filter(
      (tab) => tab.id !== activeTabId && tab.pageType !== 'sdui-panel'
    )
    return refreshTabTitles(targets, {
      onTitle: (tabId, title) => {
        useWorkspaceTabsStore.getState().setTabTitle(tabId, title)
      },
      shouldContinue: () => i18next.language === lang,
      shouldRefresh: (tabId) =>
        useWorkspaceTabsStore.getState().activeTabId !== tabId,
    })
  }

  const requestToggle = () => {
    if (hasSduiUnsavedWork()) {
      setConfirmOpen(true)
      return
    }
    void performSwitch()
  }

  return {
    confirmOpen,
    requestToggle,
    confirmSwitch: () => void performSwitch(),
    cancelSwitch: () => {
      setConfirmOpen(false)
    },
  }
}
