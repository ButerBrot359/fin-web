import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import {
  enrollFaceIdUser,
  faceIdHttpStatus,
  getFaceIdUser,
} from '../api/face-id-api'
import { FaceIdPhotoPicker } from './face-id-photo-picker'

export function FaceIdPhotoForm({ userEntryId }: { userEntryId: number }) {
  // Переход к другому человеку уничтожает preview, consent и незавершённую конвертацию.
  return <FaceIdPhotoFormContent key={userEntryId} userEntryId={userEntryId} />
}

function FaceIdPhotoFormContent({ userEntryId }: { userEntryId: number }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const queryKey = ['face-id-user', userEntryId]
  const [mustRefresh, setMustRefresh] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const query = useQuery({
    queryKey,
    queryFn: () => getFaceIdUser(userEntryId),
    retry: false,
    refetchOnWindowFocus: false,
  })
  const upload = useMutation({
    mutationFn: (image: string) => enrollFaceIdUser(userEntryId, image),
    retry: false,
    onSuccess: (data) => {
      client.setQueryData(queryKey, data)
      setMessage('faceId.saved')
    },
    onError: (error) => {
      const status = faceIdHttpStatus(error)
      const uncertain = !status || status >= 500 || status === 409
      setMustRefresh(uncertain)
      setMessage(
        uncertain
          ? 'faceId.uploadUncertain'
          : status === 422
            ? 'faceId.badPhoto'
            : status === 403
              ? 'faceId.forbidden'
              : 'faceId.uploadFailed'
      )
    },
  })
  const refresh = async () => {
    const result = await query.refetch()
    if (result.isSuccess) {
      setMustRefresh(false)
      setMessage(null)
    }
  }

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
            void query.refetch()
          }}
        >
          {t('faceId.refresh')}
        </Button>
      </div>
    )

  const user = query.data
  return (
    <div className="flex flex-col gap-4">
      <Typography component="h2" fontSize={20} fontWeight={700}>
        {user.userName}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('faceId.userNumber', { id: userEntryId })}
      </Typography>
      <Typography variant="body2">{t('faceId.photoExplanation')}</Typography>
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
      {user.registered ? (
        <Typography role="status">{t('faceId.registered')}</Typography>
      ) : (
        user.accountAvailable && (
          <>
            {!user.canManage && (
              <Typography role="status">{t('faceId.forbidden')}</Typography>
            )}
            <FaceIdPhotoPicker
              disabled={!user.canManage || mustRefresh || query.isFetching}
              uploading={upload.isPending}
              onSubmit={(image) => {
                setMessage(null)
                upload.mutate(image)
              }}
            />
          </>
        )
      )}
      {mustRefresh && (
        <Button
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => {
            void refresh()
          }}
        >
          {t('faceId.refresh')}
        </Button>
      )}
    </div>
  )
}
