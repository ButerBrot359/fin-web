import { useState, type FC, type SyntheticEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { TextField } from '@mui/material'

import { loginFieldSx } from '@/features/auth'
import { Button } from '@/shared/ui/buttons/button'

/**
 * Общий шаг «задать новый пароль» (SCRUM-355 §3): и после кода из письма, и
 * после перехода по ссылке. Совпадение с повтором проверяется здесь — это
 * опечатка в ЭТОЙ форме; требования к паролю проверяет сервер (400 с текстом),
 * дублировать его правила на клиенте значит однажды разойтись.
 */
export const NewPasswordForm: FC<{
  onSubmit: (password: string) => void
  submitting: boolean
  error: string | null
  onEdited: () => void
}> = ({ onSubmit, submitting, error, onEdited }) => {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [repeated, setRepeated] = useState('')
  const [mismatch, setMismatch] = useState(false)

  const handleSubmit = (event: SyntheticEvent) => {
    event.preventDefault()
    if (submitting) return
    if (password !== repeated) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    onSubmit(password)
  }

  const shownError = mismatch ? t('auth.passwordsDoNotMatch') : error

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col items-center gap-4"
      noValidate
    >
      <div className="flex w-full flex-col gap-4">
        <TextField
          label={t('auth.newPasswordLabel')}
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value)
            setMismatch(false)
            onEdited()
          }}
          autoComplete="new-password"
          autoFocus
          disabled={submitting}
          sx={loginFieldSx}
        />
        <TextField
          label={t('auth.repeatPasswordLabel')}
          type="password"
          value={repeated}
          onChange={(event) => {
            setRepeated(event.target.value)
            setMismatch(false)
            onEdited()
          }}
          autoComplete="new-password"
          error={!!shownError}
          helperText={shownError ?? ' '}
          disabled={submitting}
          sx={loginFieldSx}
        />
      </div>
      <Button
        type="submit"
        variant="primary"
        disabled={submitting || !password || !repeated}
        className="mt-4"
      >
        {t('auth.recovery.submitPassword')}
      </Button>
    </form>
  )
}
