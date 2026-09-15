import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FormControlLabel, Switch, TextField, Typography } from '@mui/material'

import { Button } from '@/shared/ui/buttons'

import {
  faceIdHttpStatus,
  getFaceIdSettings,
  updateFaceIdSettings,
} from '../api/face-id-api'
import type { FaceIdSettings } from '../types/face-id'

const QUERY_KEY = ['face-id-settings']

export function FaceIdSettingsForm() {
  const { t } = useTranslation()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getFaceIdSettings,
    retry: false,
  })
  if (query.isPending)
    return <Typography role="status">{t('faceId.loading')}</Typography>
  if (query.isError)
    return (
      <Typography role="alert" color="error">
        {t(
          faceIdHttpStatus(query.error) === 403
            ? 'faceId.forbidden'
            : 'faceId.loadFailed'
        )}
      </Typography>
    )
  return (
    <SettingsContent
      key={`${String(query.data.configured)}:${String(query.data.experimentalAuthenticationAllowed)}`}
      settings={query.data}
    />
  )
}

function SettingsContent({ settings }: { settings: FaceIdSettings }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [draftEnabled, setDraftEnabled] = useState<boolean | null>(null)
  const enabled = draftEnabled ?? settings.enabled
  const [reason, setReason] = useState('')
  const [saved, setSaved] = useState(false)
  const update = useMutation({
    mutationFn: () => updateFaceIdSettings(enabled, reason.trim()),
    retry: false,
    onSuccess: (data) => {
      client.setQueryData(QUERY_KEY, data)
      setDraftEnabled(null)
      setSaved(true)
    },
  })
  const canEnable =
    settings.configured && settings.experimentalAuthenticationAllowed
  return (
    <div className="flex max-w-3xl flex-col items-start gap-4">
      <Typography variant="body1">{t('faceId.settingsExplanation')}</Typography>
      <Typography variant="body2">
        {t(settings.configured ? 'faceId.configured' : 'faceId.notConfigured')}
      </Typography>
      {!settings.experimentalAuthenticationAllowed && (
        <Typography variant="body2">
          {t('faceId.experimentalDisabled')}
        </Typography>
      )}
      <Typography variant="body2" className="break-all">
        {t('faceId.serviceUrl', { url: settings.serviceUrl || '—' })}
      </Typography>
      <Typography variant="body2" className="break-all">
        {t('faceId.callbackUrl', { url: settings.callbackUrl || '—' })}
      </Typography>
      <Typography variant="body2">
        {t(
          settings.managementMode === 'AUTHENTICATED'
            ? 'faceId.authenticatedManagement'
            : 'faceId.restrictedManagement'
        )}
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={enabled}
            disabled={update.isPending || (!canEnable && !enabled)}
            onChange={(_, value) => {
              setDraftEnabled(value)
              setSaved(false)
            }}
          />
        }
        label={<Typography>{t('faceId.enabled')}</Typography>}
      />
      <TextField
        label={t('faceId.reason')}
        value={reason}
        onChange={(event) => {
          setReason(event.target.value)
          setSaved(false)
        }}
        fullWidth
        multiline
        minRows={2}
        slotProps={{ htmlInput: { maxLength: 500 } }}
        disabled={update.isPending}
      />
      <Button
        variant="primary"
        disabled={
          update.isPending ||
          enabled === settings.enabled ||
          !reason.trim() ||
          (enabled && !canEnable)
        }
        onClick={() => {
          update.mutate()
        }}
      >
        {t('faceId.saveSettings')}
      </Button>
      {saved && (
        <Typography role="status">{t('faceId.settingsSaved')}</Typography>
      )}
      {update.isError && (
        <Typography role="alert" color="error">
          {t(
            faceIdHttpStatus(update.error) === 403
              ? 'faceId.forbidden'
              : 'faceId.settingsFailed'
          )}
        </Typography>
      )}
    </div>
  )
}
