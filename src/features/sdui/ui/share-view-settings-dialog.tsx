import { useState, type FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/ui/buttons'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewSettingsPatchEntry } from '../api/view-settings-api'
import { viewSettingsPresetsApi } from '../api/view-settings-presets-api'

interface ShareViewSettingsDialogProps {
  open: boolean
  screenKey: string
  /** Текущее состояние настроек из диалога «Изменить форму» — что видишь, тем и делишься. */
  buildPatch: () => ViewSettingsPatchEntry[]
  onClose: () => void
}

/**
 * Публикация настроек формы в общий каталог («поделиться настройками»): одно
 * поле — название, под которым пресет увидят коллеги с той же ролью. Повторная
 * публикация с тем же названием перезаписывает свой же пресет — это ожидаемый
 * способ «обновить».
 */
export const ShareViewSettingsDialog: FC<ShareViewSettingsDialogProps> = ({
  open,
  screenKey,
  buildPatch,
  onClose,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState('')

  const publishMutation = useMutation({
    mutationFn: () =>
      viewSettingsPresetsApi.publish(screenKey, name, buildPatch()),
    onSuccess: () => {
      showToast('success', t('sdui.customizeForm.shareSuccess'))
      setName('')
      onClose()
    },
    onError: () => {
      showToast('error', t('sdui.customizeForm.shareFailed'))
    },
  })

  const canPublish = name.trim() !== '' && !publishMutation.isPending

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('sdui.customizeForm.shareTitle')}</DialogTitle>
      <DialogContent className="flex flex-col gap-4">
        <Typography variant="body2">
          {t('sdui.customizeForm.shareHint')}
        </Typography>
        <TextField
          autoFocus
          label={t('sdui.customizeForm.shareName')}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canPublish) publishMutation.mutate()
          }}
          slotProps={{ htmlInput: { maxLength: 256 } }}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="secondary"
          onClick={onClose}
          disabled={publishMutation.isPending}
        >
          {t('sdui.customizeForm.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={() => {
            publishMutation.mutate()
          }}
          disabled={!canPublish}
        >
          {t('sdui.customizeForm.sharePublish')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
