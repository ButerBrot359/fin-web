import { Suspense, lazy } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { useAnalyticsItem } from '@/entities/analytics'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import {
  ANALYTICS_ASSISTANT_CODE,
  ANALYTICS_SETTINGS_CODE,
} from '../lib/consts/reserved-codes'

/**
 * Страницы раздела грузим лениво: ассистент и настройки нужны редко, а дашборд
 * и отчёт тянут за собой рендер виджетов — незачем класть всё это в чанк
 * маршрута.
 */
const AnalyticsAssistantPage = lazy(() =>
  import('@/pages/analytics/analytics-assistant').then((m) => ({
    default: m.AnalyticsAssistantPage,
  }))
)
const AnalyticsAiSettingsPage = lazy(() =>
  import('@/pages/analytics/analytics-ai-settings').then((m) => ({
    default: m.AnalyticsAiSettingsPage,
  }))
)
const AnalyticsDashboardPage = lazy(() =>
  import('@/pages/analytics/analytics-dashboard').then((m) => ({
    default: m.AnalyticsDashboardPage,
  }))
)
const AnalyticsReportPage = lazy(() =>
  import('@/pages/analytics/analytics-report').then((m) => ({
    default: m.AnalyticsReportPage,
  }))
)

/**
 * Диспетчер раздела «Аналитика»: один маршрут
 * `/modules/:pageCode/analytics/:code` на всё.
 *
 * Так сделано потому, что дашборды и отчёты заводятся пользователем в рантайме
 * — их коды заранее неизвестны, отдельного маршрута под каждый быть не может.
 * Что рендерить, решает `kind` сохранённого объекта. Два кода зарезервированы
 * под служебные страницы и до бэкенда не доходят: `assistant` и `settings`.
 */
export const AnalyticsRouterPage = () => {
  const { t } = useTranslation()
  const { code } = useParams<{ code: string }>()

  const isReserved =
    code === ANALYTICS_ASSISTANT_CODE || code === ANALYTICS_SETTINGS_CODE

  // Служебные коды объектами не являются — запрос по ним не делаем.
  const { item, isLoading } = useAnalyticsItem(isReserved ? undefined : code)

  const renderContent = () => {
    if (code === ANALYTICS_ASSISTANT_CODE) return <AnalyticsAssistantPage />
    if (code === ANALYTICS_SETTINGS_CODE) return <AnalyticsAiSettingsPage />

    if (isLoading) return <PageSkeleton />

    if (item?.kind === 'DASHBOARD') {
      return <AnalyticsDashboardPage item={item} />
    }
    if (item?.kind === 'REPORT') return <AnalyticsReportPage item={item} />

    return (
      <div className="pt-5">
        <Typography variant="body2" className="text-support-01">
          {t('analytics.errors.notFound')}
        </Typography>
      </div>
    )
  }

  return <Suspense fallback={<PageSkeleton />}>{renderContent()}</Suspense>
}
