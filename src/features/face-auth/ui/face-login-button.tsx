import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import type { TokenPair } from '@/shared/types/auth.types'
import { Button } from '@/shared/ui/buttons/button'

import { useFaceCapture } from '../lib/hooks/use-face-capture'
import { faceOutcomeMessageKey } from '../lib/outcome-message'
import { FaceFlashOverlay } from './face-flash-overlay'
import { PhotosensitivityWarning } from './photosensitivity-warning'

interface FaceLoginButtonProps {
  /** Логин из формы входа. Пустой — кнопка неактивна: серверу нужно знать, чей эталон сверять. */
  login: string
  /**
   * Вызывается после успешной проверки и получает токены.
   *
   * Сессию заводит форма входа, а не эта фича: она знает про хранилище аутентификации, а слайс
   * входа по лицу — только про съёмку и проверку. Иначе его нельзя было бы переиспользовать
   * нигде, кроме экрана логина.
   */
  onSuccess: (tokens: TokenPair) => void
  disabled?: boolean
}

/**
 * Кнопка входа по лицу со всей обвязкой (ADR-0069 §D11).
 *
 * Порядок жёсткий: предупреждение о световой вспышке → съёмка → результат. Предупреждение
 * показывается до каждой попытки, а не однажды при первом заходе: «согласился один раз и больше
 * не спрашиваем» здесь неуместно — за компьютером в бухгалтерии может оказаться другой человек,
 * которому эта вспышка противопоказана.
 *
 * Кнопка блокируется на время попытки (§D11, §D13). Причина измеренная: на остывшем движке ответ
 * приходит через 8–10 секунд, и повторное нажатие израсходовало бы второй челлендж и вторую
 * попытку из пяти — человек приблизился бы к блокировке, ничего не сделав неправильно.
 */
export const FaceLoginButton = ({
  login,
  onSuccess,
  disabled,
}: FaceLoginButtonProps) => {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const { state, run, reset } = useFaceCapture(videoRef)
  const [warningOpen, setWarningOpen] = useState(false)

  const busy = state.phase !== 'idle' && state.phase !== 'done'
  const messageKey = faceOutcomeMessageKey(state.outcome)

  const handleStart = async () => {
    setWarningOpen(false)
    const outcome = await run(login)
    if (outcome.kind === 'success') {
      onSuccess(outcome.tokens)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={busy || disabled || login.trim().length === 0}
        onClick={() => {
          reset()
          setWarningOpen(true)
        }}
      >
        {t('auth.face.button')}
      </Button>

      {messageKey !== null && (
        <Typography variant="caption" color="error" role="alert">
          {/* `as never` — приём, принятый в проекте для динамических ключей (см. label-node.tsx):
              i18next типизирует t() по литералам, а ключ здесь вычисляется из ответа сервера. */}
          {t(messageKey as never) as string}
        </Typography>
      )}

      <PhotosensitivityWarning
        open={warningOpen}
        onStart={handleStart}
        onUsePassword={() => {
          setWarningOpen(false)
        }}
      />

      <FaceFlashOverlay ref={videoRef} state={state} />
    </>
  )
}
