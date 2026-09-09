import { useState, type FC } from 'react'
import { useNavigate } from 'react-router-dom'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import {
  useNotificationHistoryStore,
  type NotificationRecord,
} from '@/entities/notification-history'

import { NotificationDetailsDialog } from './notification-details-dialog'

const LEVEL_DOT: Record<NotificationRecord['level'], string> = {
  error: 'bg-support-01',
  warning: 'bg-support-03',
  success: 'bg-support-02',
  info: 'bg-accent-02',
}

/**
 * История оповещений за сеанс (SCRUM-317 канал №8). Запись с notify.route
 * остаётся кликабельной: всплывашка гаснет за секунды, переход должен
 * оставаться доступен (v2 §4.1). У записи об ошибке — «Подробнее» (канал №9):
 * диалог с деталями и копированием, без отправки.
 */
export const NotificationCenterPanel: FC<{ onNavigate: () => void }> = ({
  onNavigate,
}) => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const records = useNotificationHistoryStore((s) => s.records)
  const clear = useNotificationHistoryStore((s) => s.clear)
  const [details, setDetails] = useState<NotificationRecord | null>(null)

  const formatTime = (at: number) =>
    new Date(at).toLocaleTimeString(i18n.language === 'kz' ? 'kk' : 'ru', {
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="flex w-[400px] flex-col">
      <div className="flex items-center justify-between border-b border-ui-03 px-4 py-2">
        <Typography variant="body2" className="font-bold text-ui-06">
          {t('notificationCenter.title')}
        </Typography>
        {records.length > 0 && (
          <Button variant="tertiary" size="small" onClick={clear}>
            {t('notificationCenter.clear')}
          </Button>
        )}
      </div>
      {records.length === 0 ? (
        <Typography
          variant="body2"
          className="px-4 py-6 text-center text-ui-05"
        >
          {t('notificationCenter.empty')}
        </Typography>
      ) : (
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {records.map((r) => (
            <li
              key={r.id}
              className="flex items-start gap-2 px-4 py-2 hover:bg-ui-02"
            >
              <span
                className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${LEVEL_DOT[r.level]}`}
              />
              <div className="min-w-0 flex-1">
                {r.route ? (
                  <button
                    type="button"
                    className="cursor-pointer text-left text-accent-02 hover:underline"
                    onClick={() => {
                      onNavigate()
                      void navigate(r.route ?? '/')
                    }}
                  >
                    <Typography variant="body2">{r.title}</Typography>
                  </button>
                ) : (
                  <Typography variant="body2" className="text-ui-06">
                    {r.title}
                  </Typography>
                )}
                {r.description && (
                  <Typography variant="body2" className="text-ui-05">
                    {r.description}
                  </Typography>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Typography variant="body2" className="text-ui-05">
                  {formatTime(r.at)}
                </Typography>
                {r.level === 'error' && (
                  <button
                    type="button"
                    className="cursor-pointer text-xs text-accent-02 hover:underline"
                    onClick={() => {
                      setDetails(r)
                    }}
                  >
                    {t('notificationCenter.details')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <NotificationDetailsDialog
        record={details}
        onClose={() => {
          setDetails(null)
        }}
      />
    </div>
  )
}
