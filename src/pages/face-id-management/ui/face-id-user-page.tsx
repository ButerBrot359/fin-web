import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { FaceIdPhotoForm } from '@/features/face-id-service'
import { Button } from '@/shared/ui/buttons'

export function FaceIdUserPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { userEntryId } = useParams()
  const id = Number(userEntryId)
  const valid =
    !!userEntryId &&
    /^\d+$/.test(userEntryId) &&
    Number.isSafeInteger(id) &&
    id > 0

  return (
    <section className="flex h-full flex-col gap-8 overflow-y-auto p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography component="h1" fontSize={26} fontWeight={700}>
          {t('faceId.photoTitle')}
        </Typography>
        <Button
          variant="tertiary"
          onClick={() => {
            void navigate('/admin/face-id-settings')
          }}
        >
          {t('faceId.settingsTitle')}
        </Button>
      </div>
      <div className="max-w-3xl">
        {valid ? (
          <FaceIdPhotoForm target={{ kind: 'user', userEntryId: id }} />
        ) : (
          <Typography role="alert" color="error">
            {t('faceId.invalidUser')}
          </Typography>
        )}
      </div>
    </section>
  )
}
