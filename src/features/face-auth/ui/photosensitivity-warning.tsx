import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'

import { Button } from '@/shared/ui/buttons/button'

interface PhotosensitivityWarningProps {
  open: boolean
  onStart: () => void
  onUsePassword: () => void
}

/**
 * Предупреждение о световой вспышке перед входом по лицу (ADR-0069 §D11).
 *
 * <b>Показывается ДО съёмки, а не в справке.</b> Проверка живости несколько раз за пару секунд
 * заливает весь экран насыщенным цветом — для людей с фотосенситивной эпилепсией это возможный
 * триггер приступа. Предупреждение, доступное только тому, кто догадался открыть справку,
 * защищает разработчика, а не пользователя.
 *
 * Отказ — полноразмерная кнопка рядом, а не мелкая ссылка снизу: у человека, которому этот
 * способ входа противопоказан, выход должен быть очевиден, а не найден. Акцент оставлен на
 * «начать» — за этим пользователь и нажал кнопку входа по лицу, — но отказ не спрятан.
 * Вход по паролю никуда не девается: контур входа по лицу его не заменяет.
 */
export const PhotosensitivityWarning = ({
  open,
  onStart,
  onUsePassword,
}: PhotosensitivityWarningProps) => {
  const { t } = useTranslation()

  return (
    <Dialog
      open={open}
      onClose={onUsePassword}
      maxWidth="xs"
      aria-labelledby="face-auth-warning-title"
    >
      <DialogTitle id="face-auth-warning-title">
        {t('auth.face.warningTitle')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2">{t('auth.face.warningText')}</Typography>
      </DialogContent>
      <DialogActions className="flex-col gap-2 p-4 sm:flex-row">
        <Button
          onClick={onUsePassword}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          {t('auth.face.warningUsePassword')}
        </Button>
        <Button
          onClick={onStart}
          variant="primary"
          className="w-full sm:w-auto"
        >
          {t('auth.face.warningStart')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
