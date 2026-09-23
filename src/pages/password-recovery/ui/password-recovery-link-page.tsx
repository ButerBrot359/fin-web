import { useEffect, useState } from 'react'
import { Link as RouterLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { Link, Typography } from '@mui/material'

import { LOGIN_ROUTE, extractAuthError, useAuthStore } from '@/features/auth'
import {
  completePasswordRecovery,
  verifyPasswordRecoveryLink,
} from '@/shared/api/auth/password-recovery-endpoints'

import { RecoveryCard } from './recovery-card'
import { NewPasswordForm } from './new-password-form'

/**
 * Переход по ссылке из письма (SCRUM-355 §3.2): маршрут РОВНО
 * `/password-recovery/link`, параметр РОВНО `token` — этот адрес бэк уже
 * кладёт в письма. Токен из адресной строки не логируется и сразу убирается
 * из URL (replaceState), чтобы не утечь через историю браузера и Referer.
 */
export const PasswordRecoveryLinkPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signOut = useAuthStore((state) => state.signOut)

  const [ticket, setTicket] = useState<string | null>(null)
  const [linkRejected, setLinkRejected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const verifyLink = useMutation({
    mutationFn: verifyPasswordRecoveryLink,
    onSuccess: (res) => {
      setTicket(res.ticket)
    },
    onError: () => {
      // 401 = ссылка недействительна, просрочена либо уже использована
      setLinkRejected(true)
    },
  })

  const complete = useMutation({
    mutationFn: ({ pass, tick }: { pass: string; tick: string }) =>
      completePasswordRecovery(tick, pass),
    onSuccess: async () => {
      // Все сессии отозваны сервером — чистим локальное состояние и на вход.
      await signOut()
      void navigate(LOGIN_ROUTE, { replace: true })
    },
    onError: (err: unknown) => {
      setError(extractAuthError(err, t('auth.unavailable')))
    },
  })

  const verifyLinkMutate = verifyLink.mutate
  useEffect(() => {
    // Токен читаем напрямую из адресной строки и тут же затираем: через
    // useSearchParams значение осталось бы и в состоянии роутера.
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) {
      // Асинхронно: синхронный setState в теле эффекта каскадит рендеры
      // и запрещён линтом.
      queueMicrotask(() => {
        setLinkRejected(true)
      })
      return
    }
    window.history.replaceState(null, '', window.location.pathname)
    verifyLinkMutate(token)
  }, [verifyLinkMutate])

  return (
    <RecoveryCard title={t('auth.recovery.title')}>
      {ticket !== null && (
        <NewPasswordForm
          onSubmit={(password) => {
            complete.mutate({ pass: password, tick: ticket })
          }}
          submitting={complete.isPending}
          error={error}
          onEdited={() => {
            setError(null)
          }}
        />
      )}

      {ticket === null && linkRejected && (
        <div className="flex w-full flex-col items-center gap-4">
          <Typography role="status" variant="body2" color="text.secondary">
            {t('auth.recovery.linkInvalid')}
          </Typography>
          <Link
            component={RouterLink}
            to="/password-recovery"
            underline="hover"
          >
            {t('auth.recovery.requestNew')}
          </Link>
        </div>
      )}

      {ticket === null && !linkRejected && (
        <Typography
          role="status"
          variant="body2"
          color="text.secondary"
          className="text-center"
        >
          {t('auth.recovery.checkingLink')}
        </Typography>
      )}

      <div className="mt-6 flex justify-center">
        <Link component={RouterLink} to={LOGIN_ROUTE} underline="hover">
          {t('auth.recovery.backToLogin')}
        </Link>
      </div>
    </RecoveryCard>
  )
}
