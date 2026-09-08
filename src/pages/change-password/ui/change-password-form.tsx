import { useState, type SyntheticEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { TextField, Typography } from '@mui/material'

import { LOGIN_ROUTE, useAuthStore } from '@/features/auth'
import { requestChangePassword } from '@/shared/api/auth/auth-endpoints'
import { getAccessToken } from '@/shared/api/auth/token-storage'
import { Button } from '@/shared/ui/buttons/button'

import { extractAuthError } from '@/pages/login/lib/extract-auth-error'

import { loginFieldSx } from '@/pages/login/ui/login-field-sx'

/**
 * Форма смены пароля.
 *
 * <b>После успешной смены человек уходит на экран входа, а не в приложение.</b> Сервер
 * отзывает все refresh-токены владельца (пароль меняют в том числе после компрометации), и
 * оставлять на экране приложение, которое доживает на старом access-токене минуты и потом
 * само выбросит на вход, — хуже, чем сразу попросить войти заново.
 *
 * Совпадение нового пароля с повтором проверяется здесь, а не на сервере: это опечатка в
 * ЭТОЙ форме, серверу второе поле не отправляется вовсе. Длину проверяет сервер — правило
 * одно и живёт в его настройках, дублировать его здесь значит однажды разойтись.
 */
export const ChangePasswordForm = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signOut = useAuthStore((state) => state.signOut)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatedPassword, setRepeatedPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    if (newPassword !== repeatedPassword) {
      setError(t('auth.passwordsDoNotMatch'))
      return
    }

    const accessToken = getAccessToken()
    if (!accessToken) {
      void navigate(LOGIN_ROUTE, { replace: true })
      return
    }

    setError(null)
    setSubmitting(true)
    try {
      await requestChangePassword(accessToken, currentPassword, newPassword)
      // Сессии отозваны сервером — локальное состояние обязано это отразить, иначе гвард
      // продолжит считать пользователя вошедшим и будет гонять его по 403.
      await signOut()
      void navigate(LOGIN_ROUTE, { replace: true })
    } catch (submitError) {
      setError(extractAuthError(submitError, t('auth.unavailable')))
    } finally {
      setSubmitting(false)
    }
  }

  const isSubmitDisabled =
    isSubmitting || !currentPassword || !newPassword || !repeatedPassword

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(event)
      }}
      className="flex w-full flex-col items-center gap-4"
      noValidate
    >
      <div className="flex w-full flex-col gap-4">
        <TextField
          label={t('auth.currentPasswordLabel')}
          type="password"
          value={currentPassword}
          onChange={(event) => {
            setCurrentPassword(event.target.value)
            setError(null)
          }}
          autoComplete="current-password"
          autoFocus
          disabled={isSubmitting}
          sx={loginFieldSx}
        />

        <TextField
          label={t('auth.newPasswordLabel')}
          type="password"
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value)
            setError(null)
          }}
          autoComplete="new-password"
          disabled={isSubmitting}
          sx={loginFieldSx}
        />

        <TextField
          label={t('auth.repeatPasswordLabel')}
          type="password"
          value={repeatedPassword}
          onChange={(event) => {
            setRepeatedPassword(event.target.value)
            setError(null)
          }}
          autoComplete="new-password"
          error={!!error}
          helperText={error ?? ' '}
          disabled={isSubmitting}
          sx={loginFieldSx}
        />
      </div>

      <Typography variant="body2" color="text.secondary" className="w-full">
        {t('auth.passwordChangeSignOutHint')}
      </Typography>

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitDisabled}
        className="mt-4"
      >
        {isSubmitting ? t('auth.submitting') : t('auth.changePasswordSubmit')}
      </Button>
    </form>
  )
}
