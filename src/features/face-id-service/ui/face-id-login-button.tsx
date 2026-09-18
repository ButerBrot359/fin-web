import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import { getFaceIdAvailability } from '../api/face-id-api'
import { prepareFaceIdRedirect } from '../lib/redirect-flow'

export function FaceIdLoginButton({
  disabled,
  returnPath,
}: {
  disabled?: boolean
  returnPath: string | null
}) {
  const { t } = useTranslation()
  const [available, setAvailable] = useState(false)
  const [checking, setChecking] = useState(true)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    void getFaceIdAvailability()
      .then((status) => {
        if (active) setAvailable(status.enabled && status.identifyEnabled)
      })
      .catch(() => {
        if (active) setAvailable(false)
      })
      .finally(() => {
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [])

  const start = async () => {
    if (busy) return
    setBusy(true)
    setFailed(false)
    try {
      window.location.assign(await prepareFaceIdRedirect(returnPath))
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled || busy || !available}
        onClick={() => {
          void start()
        }}
      >
        {busy ? t('faceId.redirecting') : t('faceId.loginButton')}
      </Button>
      {!checking && !available && (
        <Typography variant="caption" color="text.secondary">
          {t('faceId.unavailable')}
        </Typography>
      )}
      {failed && (
        <Typography role="alert" variant="body2" color="error">
          {t('faceId.startFailed')}
        </Typography>
      )}
    </div>
  )
}
