import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton, Skeleton, Tooltip, Typography } from '@mui/material'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'

import { MICRO_LABEL_SX } from '@/shared/ui/micro-label'
import RefreshIcon from '@mui/icons-material/Refresh'

export interface WidgetCardProps {
  title?: string
  /** Бэкенд подменил вид виджета под данные — показываем пометку. */
  isDegraded?: boolean
  degradedReason?: string | null
  isLoading?: boolean
  hasError?: boolean
  isEmpty?: boolean
  /** KPI: ноль — это ответ, а не «нет данных». Пустое состояние подавляется. */
  zeroIsValid?: boolean
  /** Заголовок рисует сам виджет (KPI подписывает значение снизу). */
  hideTitle?: boolean
  onRefresh?: () => void
  children: ReactNode
}

const messageClass =
  'flex h-full min-h-24 items-center justify-center px-2 text-center'

/**
 * Оболочка виджета: заголовок, пометка о подмене вида, обновление и общие
 * состояния — загрузка, ошибка, пустой результат.
 *
 * Панель без рамки и без тени: виджеты стоят на тонированном фоне `ui-02`, и
 * белый фон отделяет их сам. Рамка на каждом виджете уравнивала бы их в правах
 * с по-настоящему выделенными объектами и убивала иерархию дашборда.
 */
export const WidgetCard = ({
  title,
  isDegraded,
  degradedReason,
  isLoading,
  hasError,
  isEmpty,
  zeroIsValid,
  hideTitle,
  onRefresh,
  children,
}: WidgetCardProps) => {
  const { t } = useTranslation()

  const degradedHint = degradedReason
    ? `${t('analytics.dashboard.degraded')}: ${degradedReason}`
    : t('analytics.dashboard.degraded')

  const showHeader = !hideTitle && (title || isDegraded || onRefresh)

  const renderBody = () => {
    if (isLoading) {
      return (
        <div className="flex h-full min-h-24 flex-col gap-2">
          <Skeleton variant="rounded" height="100%" />
        </div>
      )
    }
    if (hasError) {
      return (
        <div className={messageClass}>
          <Typography className="text-body2 text-support-01">
            {t('analytics.dashboard.widgetError')}
          </Typography>
        </div>
      )
    }
    if (isEmpty && !zeroIsValid) {
      return (
        <div className={messageClass}>
          <Typography className="text-body2 text-ui-05">
            {t('analytics.dashboard.noData')}
          </Typography>
        </div>
      )
    }
    return children
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col rounded-lg bg-ui-01 p-4">
      {showHeader && (
        <div className="mb-3 flex min-w-0 items-center gap-1.5">
          <Typography className="truncate" sx={MICRO_LABEL_SX}>
            {title}
          </Typography>
          {isDegraded && (
            <Tooltip title={degradedHint}>
              <InfoOutlinedIcon
                className="shrink-0 text-ui-05"
                sx={{ fontSize: 15 }}
              />
            </Tooltip>
          )}
          <span className="flex-1" />
          {onRefresh && (
            <Tooltip title={t('analytics.dashboard.refresh')}>
              <IconButton size="small" onClick={onRefresh}>
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </div>
      )}
      <div className="relative min-h-0 min-w-0 flex-1">{renderBody()}</div>
    </div>
  )
}
