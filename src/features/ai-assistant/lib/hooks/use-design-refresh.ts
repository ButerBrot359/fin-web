import { useQueryClient } from '@tanstack/react-query'

import type { AiAssistantAnswer } from '@/entities/ai-assistant'
import { themeKeys } from '@/entities/theme'
import { notifyViewSettingsChanged } from '@/shared/lib/design-settings/design-settings-events'

/**
 * Реакция на флаги «помощник изменил настройки дизайна» в ответе `/ask`
 * (конструктор дизайна Ф2): изменения применяет бэк, фронту достаточно
 * перечитать своё.
 *
 * - `viewSettingsChanged` → шина в shared (SDUI сам решает, переоткрывать ли
 *   форму — грязную не трогает) + инвалидация списков SDUI. Ключ 'sdui-list'
 *   продублирован литералом сознательно: импорт из features/sdui был бы
 *   связью feature→feature, которой FSD избегает.
 * - `themeChanged` → инвалидация слитой темы; ServerThemeApplier перечитает
 *   и накатит на :root сам.
 */
export const useDesignRefresh = (): ((answer: AiAssistantAnswer) => void) => {
  const queryClient = useQueryClient()

  return (answer) => {
    if (answer.viewSettingsChanged) {
      notifyViewSettingsChanged()
      void queryClient.invalidateQueries({ queryKey: ['sdui-list'] })
    }
    if (answer.themeChanged) {
      void queryClient.invalidateQueries({ queryKey: themeKeys.merged() })
    }
  }
}
