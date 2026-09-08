import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AnalyticsItem } from '@/entities/analytics'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'

import { ReportView } from './report-view'

interface AnalyticsReportPageProps {
  item: AnalyticsItem
}

/** Сохранённый отчёт: шапка вкладки + параметры, тулбар и таблица. */
export const AnalyticsReportPage = ({ item }: AnalyticsReportPageProps) => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const isKz = i18n.language === 'kz'
  const title =
    (isKz ? item.titleKz : item.titleRu) ||
    item.titleRu ||
    t('analytics.report.title')

  useTabMeta(title)

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate('/')
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={title} onClose={handleClose} />

      {item.description && (
        <Typography variant="body2" className="max-w-[70ch] text-ui-05">
          {item.description}
        </Typography>
      )}

      {/* Та же подложка, что у дашборда: раздел должен читаться как одно целое. */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto rounded-lg bg-ui-02 p-4">
        <ReportView spec={item.spec} title={title} />
      </div>
    </div>
  )
}
