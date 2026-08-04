import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

export const NotFound: FC = () => {
  const { t } = useTranslation()
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <Typography variant="h5">{t('sdui.notFound.title')}</Typography>
      <Typography variant="body2" color="text.secondary">
        {t('sdui.notFound.description')}
      </Typography>
    </div>
  )
}
