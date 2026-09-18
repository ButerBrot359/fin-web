import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import {
  prepareFaceIdPhoto,
  type PreparedFaceIdPhoto,
} from '../lib/prepare-photo'

export function FaceIdPhotoPicker({
  disabled,
  uploading,
  onSubmit,
  replacing = false,
  self = false,
}: {
  disabled: boolean
  uploading: boolean
  onSubmit: (image: string) => void
  replacing?: boolean
  self?: boolean
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const generation = useRef(0)
  const [photo, setPhoto] = useState<PreparedFaceIdPhoto | null>(null)
  const [consent, setConsent] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState(false)

  useEffect(
    () => () => {
      generation.current += 1
    },
    []
  )

  const choose = async (file?: File) => {
    const current = ++generation.current
    setPhoto(null)
    setConsent(false)
    setError(false)
    if (!file) return
    setPreparing(true)
    try {
      const prepared = await prepareFaceIdPhoto(file)
      if (current === generation.current) setPhoto(prepared)
    } catch {
      if (current === generation.current) setError(true)
    } finally {
      if (current === generation.current) setPreparing(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={t('faceId.choosePhoto')}
        disabled={disabled || uploading || preparing}
        onChange={(event) => {
          void choose(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <Button
        variant="secondary"
        disabled={disabled || uploading || preparing}
        onClick={() => {
          input.current?.click()
        }}
      >
        {t('faceId.choosePhoto')}
      </Button>
      <Typography variant="body2" color="text.secondary">
        {t('faceId.photoRequirements')}
      </Typography>
      {preparing && (
        <Typography role="status" variant="body2">
          {t('faceId.preparing')}
        </Typography>
      )}
      {photo && (
        <img
          className="max-h-64 max-w-full rounded-lg object-contain"
          src={photo.preview}
          alt={t('faceId.photoPreview')}
        />
      )}
      {error && (
        <Typography role="alert" variant="body2" color="error">
          {t('faceId.badFile')}
        </Typography>
      )}
      <FormControlLabel
        control={
          <Checkbox
            checked={consent}
            disabled={!photo || disabled || uploading}
            onChange={(_, checked) => {
              setConsent(checked)
            }}
          />
        }
        label={
          <Typography variant="body2">
            {t(self ? 'faceId.selfConsent' : 'faceId.consent')}
          </Typography>
        }
      />
      <Button
        variant="primary"
        disabled={!photo || !consent || disabled || uploading || preparing}
        onClick={() => {
          if (photo && consent) onSubmit(photo.image)
        }}
      >
        {uploading
          ? t('faceId.uploading')
          : t(replacing ? 'faceId.saveReplacement' : 'faceId.savePhoto')}
      </Button>
    </div>
  )
}
