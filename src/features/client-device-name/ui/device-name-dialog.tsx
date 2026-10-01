import { useState, type FC } from 'react'
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import {
  DEVICE_NAME_MAX_LENGTH,
  getClientDeviceName,
  setClientDeviceName,
} from '@/shared/lib/client-context'
import { Button } from '@/shared/ui/buttons'

interface DeviceNameDialogProps {
  open: boolean
  onClose: () => void
}

/**
 * «Имя компьютера» (SCRUM-371): подпись рабочего места в колонке «Компьютер» журнала
 * регистрации. Браузер сетевого имени машины не знает, поэтому имя задаёт сам пользователь;
 * хранится только в этом браузере и уходит заголовком со следующего же запроса. Пустое имя —
 * «не задано»: журнал покажет компьютер по идентификатору устройства и адресам.
 */
export const DeviceNameDialog: FC<DeviceNameDialogProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  // Поле заполняется сохранённым именем при каждом ОТКРЫТИИ — подстройкой состояния во время
  // рендера (как в ThemeSettingsDialog), без эффекта: закрыли без сохранения — черновик забыт.
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setValue(getClientDeviceName() ?? '')
  }

  const save = () => {
    setClientDeviceName(value)
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t('deviceName.title')}</DialogTitle>
      <DialogContent className="flex flex-col gap-4 pt-2">
        <Typography variant="body2">{t('deviceName.description')}</Typography>
        <TextField
          autoFocus
          size="small"
          label={t('deviceName.label')}
          placeholder={t('deviceName.placeholder')}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') save()
          }}
          slotProps={{
            htmlInput: { maxLength: DEVICE_NAME_MAX_LENGTH },
            inputLabel: { shrink: true },
          }}
          helperText={t('deviceName.hint')}
        />
      </DialogContent>
      <DialogActions>
        <Button variant="secondary" onClick={onClose}>
          {t('deviceName.cancel')}
        </Button>
        <Button variant="primary" onClick={save}>
          {t('deviceName.save')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
