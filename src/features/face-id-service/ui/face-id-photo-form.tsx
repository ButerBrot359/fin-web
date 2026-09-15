import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import { faceIdHttpStatus } from '../api/face-id-api'
import {
  faceIdPhotoIdentity,
  useFaceIdPhoto,
} from '../lib/hooks/use-face-id-photo'
import type { FaceIdPhotoTarget } from '../types/face-id'
import { FaceIdPhotoPicker } from './face-id-photo-picker'

export function FaceIdPhotoForm({ target }: { target: FaceIdPhotoTarget }) {
  // Смена человека/своей учётной записи уничтожает фото, согласие и незавершённую конвертацию.
  return (
    <FaceIdPhotoFormContent key={faceIdPhotoIdentity(target)} target={target} />
  )
}

function FaceIdPhotoFormContent({ target }: { target: FaceIdPhotoTarget }) {
  const { t } = useTranslation()
  const model = useFaceIdPhoto(target)
  const { query, upload, message, mustRefresh, replacementProfileId } = model
  if (query.isPending)
    return <Typography role="status">{t('faceId.loading')}</Typography>
  if (query.isError)
    return (
      <div className="flex flex-col items-start gap-4">
        <Typography role="alert" color="error">
          {t(
            faceIdHttpStatus(query.error) === 403
              ? 'faceId.forbidden'
              : 'faceId.loadFailed'
          )}
        </Typography>
        <Button
          variant="secondary"
          onClick={() => {
            void model.refresh()
          }}
        >
          {t('faceId.refresh')}
        </Button>
      </div>
    )

  const user = query.data
  const replacing = replacementProfileId !== null
  const canEdit = replacing ? user.canReplace : user.canManage
  return (
    <div className="flex flex-col gap-4">
      <Typography component="h2" fontSize={20} fontWeight={700}>
        {user.userName}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('faceId.userNumber', { id: user.userEntryId })}
      </Typography>
      <Typography variant="body2">
        {t(
          target.kind === 'self'
            ? 'faceId.selfPhotoExplanation'
            : 'faceId.photoExplanation'
        )}
      </Typography>
      {message && (
        <Typography
          role={upload.isError ? 'alert' : 'status'}
          color={upload.isError ? 'error' : 'text.primary'}
        >
          {t(message as never) as string}
        </Typography>
      )}
      {!user.accountAvailable && (
        <Typography role="status">{t('faceId.accountMissing')}</Typography>
      )}
      {user.registered && (
        <div className="flex flex-col items-start gap-4">
          <Typography role="status">{t('faceId.registered')}</Typography>
          {!replacing && (
            <Button
              variant="secondary"
              disabled={
                !user.canReplace ||
                !user.profile ||
                mustRefresh ||
                query.isFetching ||
                upload.isPending
              }
              onClick={model.startReplacement}
            >
              {t('faceId.replacePhoto')}
            </Button>
          )}
          {!user.canReplace && (
            <Typography variant="body2" color="text.secondary">
              {t('faceId.replacementForbidden')}
            </Typography>
          )}
        </div>
      )}
      {user.accountAvailable && (!user.registered || replacing) && (
        <>
          {replacing && (
            <Typography variant="body2">
              {t('faceId.replacementExplanation')}
            </Typography>
          )}
          {!canEdit && (
            <Typography role="status">{t('faceId.forbidden')}</Typography>
          )}
          <FaceIdPhotoPicker
            key={model.pickerVersion}
            self={target.kind === 'self'}
            replacing={replacing}
            disabled={!canEdit || mustRefresh || query.isFetching}
            uploading={upload.isPending}
            onSubmit={model.submit}
          />
          {replacing && (
            <div>
              <Button
                variant="tertiary"
                disabled={upload.isPending}
                onClick={model.cancelReplacement}
              >
                {t('actions.cancel')}
              </Button>
            </div>
          )}
        </>
      )}
      {mustRefresh && (
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => {
            void model.refresh()
          }}
        >
          {t('faceId.refresh')}
        </Button>
      )}
    </div>
  )
}
