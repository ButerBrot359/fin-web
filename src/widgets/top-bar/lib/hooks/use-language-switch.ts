import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { closeAllSduiSessions, hasSduiUnsavedWork } from '@/features/sdui'

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
    await i18n.changeLanguage(nextLang)
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
    cancelSwitch: () => setConfirmOpen(false),
  }
}
