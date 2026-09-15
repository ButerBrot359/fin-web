import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { FaceIdSettingsForm } from '@/features/face-id-service'

export function FaceIdSettingsPage() {
  const { t } = useTranslation()
  return (
    <section className="flex h-full flex-col gap-8 overflow-y-auto p-8">
      <Typography component="h1" fontSize={26} fontWeight={700}>
        {t('faceId.settingsTitle')}
      </Typography>
      <FaceIdSettingsForm />
    </section>
  )
}
