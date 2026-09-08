import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import type { FaceTemplateUploadOutcome } from '../types/face-template'

interface FacePhotoUploadProps {
  outcome: FaceTemplateUploadOutcome | null
  onFileChange: (file: File | null) => void
}

const OUTCOME_MESSAGE_KEY: Record<
  Exclude<FaceTemplateUploadOutcome['kind'], 'enrolled'>,
  string
> = {
  badPhoto: 'auth.face.photo.errorBadPhoto',
  badFile: 'auth.face.photo.errorBadFile',
  notAllowed: 'auth.face.photo.errorNotAllowed',
  unavailable: 'auth.face.photo.errorUnavailable',
  failed: 'auth.face.photo.errorGeneric',
}

export const FacePhotoUpload = ({
  outcome,
  onFileChange,
}: FacePhotoUploadProps) => {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-3">
      <Typography variant="body2">{t('auth.face.photo.hint')}</Typography>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        aria-label={t('auth.face.photo.fileLabel')}
        onChange={(event) => {
          onFileChange(event.target.files?.[0] ?? null)
        }}
      />

      {outcome !== null && outcome.kind !== 'enrolled' && (
        <Typography variant="caption" color="error" role="alert">
          {t(OUTCOME_MESSAGE_KEY[outcome.kind] as never) as string}
        </Typography>
      )}
    </div>
  )
}
