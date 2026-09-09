import type { FC } from 'react'
import { Dialog, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'

import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'
import { cssVar, shadows } from '@/shared/design/tokens'
import type { NotificationRecord } from '@/entities/notification-history'

/**
 * Диалог деталей ошибки (SCRUM-317 канал №9): текст, время, копирование.
 * Отправки разработчику намеренно НЕТ — отдельный механизм с решениями о
 * хранении и доступе; неработающая кнопка хуже её отсутствия (v1 §7.1).
 */
export const NotificationDetailsDialog: FC<{
  record: NotificationRecord | null
  onClose: () => void
}> = ({ record, onClose }) => {
  const { t, i18n } = useTranslation()

  const copy = () => {
    if (!record) return
    const text = [
      new Date(record.at).toLocaleString(i18n.language === 'kz' ? 'kk' : 'ru'),
      record.title,
      record.description ?? '',
    ]
      .filter(Boolean)
      .join('\n')
    void navigator.clipboard.writeText(text)
  }

  return (
    <Dialog
      open={record !== null}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '40px',
            boxShadow: cssVar(shadows.popup),
            p: 0,
            m: 0,
            minWidth: 660,
            maxWidth: 'none',
          },
        },
      }}
    >
      <div className="flex flex-col gap-8 px-15 py-10">
        <div className="flex w-full items-center gap-6">
          <Typography
            component="h2"
            className="flex-1 text-[26px] font-bold leading-normal text-ui-06"
          >
            {t('notificationCenter.detailsTitle')}
          </Typography>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer"
          >
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        {record && (
          <div className="flex flex-col gap-2">
            <Typography variant="body2" className="text-ui-05">
              {new Date(record.at).toLocaleString(
                i18n.language === 'kz' ? 'kk' : 'ru'
              )}
            </Typography>
            <Typography className="text-base font-medium text-ui-06">
              {record.title}
            </Typography>
            {record.description && (
              <Typography variant="body2" className="text-ui-06">
                {record.description}
              </Typography>
            )}
          </div>
        )}

        <div className="flex w-full gap-3">
          <Button
            variant="primary"
            onClick={copy}
            className="flex-1 rounded-lg"
          >
            {t('notificationCenter.copy')}
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1 rounded-lg"
          >
            {t('notificationCenter.close')}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
