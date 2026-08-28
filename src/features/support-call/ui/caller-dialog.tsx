import { Checkbox, FormControlLabel, TextField } from '@mui/material'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'

import type { SupportCallSession } from '../model/types'
import { useStartSupportCall } from '../model/use-support-call'
import { SupportDialog } from './support-dialog'

interface CallerDialogProps {
  onClose: () => void
  onConnected: (session: SupportCallSession) => void
}

/**
 * Звонок пользователя (ADR-0050).
 *
 * <p>Согласие на запись спрашивается ДО звонка: сервер без него отвечает 400, когда запись
 * включена, — и это правильный порядок, потому что в записи оказываются персональные данные.
 */
export const CallerDialog = ({ onClose, onConnected }: CallerDialogProps) => {
  const { t } = useTranslation()
  const location = useLocation()
  const [subject, setSubject] = useState('')
  const [consent, setConsent] = useState(false)
  const { mutate, isPending, error } = useStartSupportCall()

  const call = () => {
    mutate(
      {
        subject: subject.trim() || undefined,
        recordingConsent: consent,
        page: location.pathname,
      },
      { onSuccess: onConnected }
    )
  }

  return (
    <SupportDialog
      title={t('support.dialogTitle')}
      subtitle={t('support.privacyNote')}
      onClose={onClose}
      footer={
        <div className="flex w-full gap-3">
          <Button
            variant="primary"
            onClick={call}
            disabled={isPending || !consent}
            className="flex-1"
          >
            {isPending ? t('support.connecting') : t('support.callAction')}
          </Button>
          <Button variant="tertiary" onClick={onClose} className="flex-1">
            {t('actions.cancel')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {Boolean(error) && (
          <div className="rounded-lg bg-support-01/10 px-4 py-3 text-body2 text-support-01">
            {t('support.error')}
          </div>
        )}

        <TextField
          label={t('support.subject')}
          placeholder={t('support.subjectPlaceholder')}
          value={subject}
          onChange={(event) => {
            setSubject(event.target.value)
          }}
          multiline
          minRows={2}
        />

        <FormControlLabel
          control={
            <Checkbox
              checked={consent}
              onChange={(event) => {
                setConsent(event.target.checked)
              }}
            />
          }
          label={t('support.consent')}
          slotProps={{ typography: { className: 'text-body2 text-ui-06' } }}
        />
      </div>
    </SupportDialog>
  )
}
