import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { useAuthStore } from '@/features/auth'

import { LoginForm } from './login-form'

/**
 * Экран входа.
 *
 * ⚠️ Оформление временное — вёрстка по макету Figma (нода 545:22859) отдельным шагом.
 * Логика страницы от оформления отделена: здесь только восстановление сессии и защита от
 * повторного входа, вся форма — в {@link LoginForm}.
 */
export const LoginPage = () => {
  const { t } = useTranslation()
  const status = useAuthStore((state) => state.status)
  const restore = useAuthStore((state) => state.restore)

  useEffect(() => {
    restore()
  }, [restore])

  // Уже вошедшего на экране входа быть не должно: иначе кнопка «назад» после входа
  // возвращает на форму, и человек решает, что вход не сработал.
  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <Typography variant="h5" fontWeight={600}>
          {t('auth.title')}
        </Typography>
        <LoginForm />
      </div>
    </div>
  )
}
