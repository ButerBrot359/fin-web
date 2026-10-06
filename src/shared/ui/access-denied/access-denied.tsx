import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

/**
 * Экран «Нет доступа» (SCRUM-400 §5.2): 403 по правам на открытии экрана.
 * `message` — человекочитаемая причина сервера («Нет права на просмотр:
 * Документ «Табель»»), показывается как есть; без неё — общий текст.
 */
export const AccessDenied: FC<{ message?: string | null }> = ({ message }) => {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Typography variant="h5">{t('sdui.accessDenied.title')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {message ?? t('sdui.accessDenied.description')}
      </Typography>
    </div>
  )
}
