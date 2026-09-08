import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { AnalyticsItem } from '@/entities/analytics'
import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'

import { DashboardView } from './dashboard-view'

interface AnalyticsDashboardPageProps {
  item: AnalyticsItem
}

/** Сохранённый дашборд: шапка вкладки + параметры и сетка виджетов. */
export const AnalyticsDashboardPage = ({
  item,
}: AnalyticsDashboardPageProps) => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const isKz = i18n.language === 'kz'
  const title =
    (isKz ? item.titleKz : item.titleRu) ||
    item.titleRu ||
    t('analytics.dashboard.title')

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

      {/*
        Тонированная подложка: виджеты — белые панели без рамок, и отделяет их
        друг от друга именно контраст с фоном. На белом фоне они слились бы в
        одно поле, и рамку пришлось бы возвращать каждому.
      */}
      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto rounded-lg bg-ui-02 p-4">
        <DashboardView spec={item.spec} />
      </div>
    </div>
  )
}
