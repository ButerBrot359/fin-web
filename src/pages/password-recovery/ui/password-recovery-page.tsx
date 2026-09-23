import { useState, type SyntheticEvent } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { Link, TextField, Typography } from '@mui/material'

import {
  LOGIN_ROUTE,
  extractAuthError,
  loginFieldSx,
  useAuthStore,
} from '@/features/auth'
import {
  completePasswordRecovery,
  requestPasswordRecovery,
  verifyPasswordRecoveryCode,
} from '@/shared/api/auth/password-recovery-endpoints'
import { Button } from '@/shared/ui/buttons/button'

import { RecoveryCard } from './recovery-card'
import { NewPasswordForm } from './new-password-form'

/**
 * «Забыли пароль?» — три шага одной страницей (SCRUM-355 §3.1):
 * email → POST /request; код из письма → POST /verify; новый пароль дважды →
 * POST /complete → на экран входа.
 *
 * Ответ /request одинаков для существующего и несуществующего адреса и текст
 * показывается как есть — из него (и из задержки) не выводится, найден ли
 * пользователь. Длина кода настраивается администратором — маска не зашита.
 * Тикет между шагами живёт в state экрана: не в query-кеше и не в localStorage.
 */
export const PasswordRecoveryPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signOut = useAuthStore((state) => state.signOut)

  const [step, setStep] = useState<'email' | 'code' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [ticket, setTicket] = useState('')
  const [ackMessage, setAckMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const request = useMutation({
    mutationFn: requestPasswordRecovery,
    onSuccess: (ack) => {
      setAckMessage(ack.message)
      setStep('code')
    },
    onError: (err: unknown) => {
      setError(extractAuthError(err, t('auth.unavailable')))
    },
  })

  const verify = useMutation({
    mutationFn: ({ mail, value }: { mail: string; value: string }) =>
      verifyPasswordRecoveryCode(mail, value),
    onSuccess: (res) => {
      setTicket(res.ticket)
      setError(null)
      setStep('password')
    },
    // 401: код неверен, просрочен, использован либо email не найден — текст
    // сервера намеренно скуп, свой поверх не сочиняем.
    onError: (err: unknown) => {
      setError(extractAuthError(err, t('auth.unavailable')))
    },
  })

  const complete = useMutation({
    mutationFn: (password: string) =>
      completePasswordRecovery(ticket, password),
    onSuccess: async () => {
      // Все сессии отозваны сервером — чистим локальное состояние и на вход.
      await signOut()
      void navigate(LOGIN_ROUTE, { replace: true })
    },
    onError: (err: unknown) => {
      setError(extractAuthError(err, t('auth.unavailable')))
    },
  })

  const submitEmail = (event: SyntheticEvent) => {
    event.preventDefault()
    if (request.isPending || !email) return
    setError(null)
    request.mutate(email)
  }

  const submitCode = (event: SyntheticEvent) => {
    event.preventDefault()
    if (verify.isPending || !code) return
    setError(null)
    verify.mutate({ mail: email, value: code })
  }

  return (
    <RecoveryCard title={t('auth.recovery.title')}>
      {step === 'email' && (
        <form
          onSubmit={submitEmail}
          className="flex w-full flex-col items-center gap-4"
          noValidate
        >
          <div className="flex w-full flex-col gap-4">
            <TextField
              label={t('auth.recovery.emailLabel')}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value)
                setError(null)
              }}
              autoComplete="email"
              autoFocus
              error={!!error}
              helperText={error ?? ' '}
              disabled={request.isPending}
              sx={loginFieldSx}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={request.isPending || !email}
            className="mt-4"
          >
            {request.isPending
              ? t('auth.recovery.sending')
              : t('auth.recovery.sendCode')}
          </Button>
        </form>
      )}

      {step === 'code' && (
        <form
          onSubmit={submitCode}
          className="flex w-full flex-col items-center gap-4"
          noValidate
        >
          {ackMessage && (
            <Typography
              role="status"
              variant="body2"
              color="text.secondary"
              className="w-full"
            >
              {ackMessage}
            </Typography>
          )}
          <div className="flex w-full flex-col gap-4">
            <TextField
              label={t('auth.recovery.codeLabel')}
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                setError(null)
              }}
              autoComplete="one-time-code"
              autoFocus
              error={!!error}
              helperText={error ?? ' '}
              disabled={verify.isPending}
              sx={loginFieldSx}
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={verify.isPending || !code}
            className="mt-4"
          >
            {t('auth.recovery.verify')}
          </Button>
          {/* Повтор в антифлуд-окне сервер отклонит тем же 200 с другим текстом */}
          <Button
            type="button"
            variant="tertiary"
            disabled={request.isPending}
            onClick={() => {
              setError(null)
              request.mutate(email)
            }}
          >
            {t('auth.recovery.resend')}
          </Button>
        </form>
      )}

      {step === 'password' && (
        <NewPasswordForm
          onSubmit={(password) => {
            complete.mutate(password)
          }}
          submitting={complete.isPending}
          error={error}
          onEdited={() => {
            setError(null)
          }}
        />
      )}

      <div className="mt-6 flex justify-center">
        <Link component={RouterLink} to={LOGIN_ROUTE} underline="hover">
          {t('auth.recovery.backToLogin')}
        </Link>
      </div>
    </RecoveryCard>
  )
}
