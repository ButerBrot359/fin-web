import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { useAiSettings } from '@/entities/analytics'
import {
  AiDisclosurePanel,
  AssistantSettingsForm,
} from '@/features/ai-assistant'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import { AiSettingsForm } from './ai-settings-form'

/**
 * Страница «Настройки ИИ» раздела «Аналитика».
 *
 * Ошибка загрузки страницу не блокирует: форма разворачивается на значениях по
 * умолчанию, и настройки можно завести с нуля — иначе организация без записи в
 * `analytics_ai_settings` не смогла бы включить ассистента вообще.
 */
export const AnalyticsAiSettingsPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  useTabMeta(t('analytics.settings.title'))

  const { settings, isLoading } = useAiSettings()

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate('/')
  }

  if (isLoading) return <PageSkeleton />

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-ui-02 pt-5 pb-6">
      <PageHeader title={t('analytics.settings.title')} onClose={handleClose} />

      {/* Ширина ограничена: поля ввода на всю ширину экрана нечитаемы, а форма
          настроек — не таблица, ей не нужен весь рабочий стол. */}
      <div className="flex w-full max-w-[720px] flex-col gap-4">
        <Typography variant="body2" className="text-ui-05">
          {t('analytics.settings.subtitle')}
        </Typography>

        {/* Раскрытие по обоим контурам сразу и ПЕРЕД формами: решение о
            провайдере принимается зная, какие данные ему достанутся. */}
        <AiDisclosurePanel />

        <AiSettingsForm settings={settings} />

        <AssistantSettingsForm />
      </div>
    </div>
  )
}
