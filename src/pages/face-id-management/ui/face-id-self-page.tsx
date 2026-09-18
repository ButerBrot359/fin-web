import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { useAuthStore } from '@/features/auth'
import { FaceIdPhotoForm } from '@/features/face-id-service'

export function FaceIdSelfPage() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  return (
    <section className="flex h-full flex-col gap-8 overflow-y-auto p-8">
      <Typography component="h1" fontSize={26} fontWeight={700}>
        {t('faceId.selfPhotoTitle')}
      </Typography>
      <div className="max-w-3xl">
        {user ? (
          <FaceIdPhotoForm target={{ kind: 'self', accountId: user.id }} />
        ) : (
          <Typography role="status">{t('faceId.signInRequired')}</Typography>
        )}
      </div>
    </section>
  )
}
