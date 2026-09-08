import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { AUTH_ENABLED, LOGIN_ROUTE, useAuthStore } from '@/features/auth'
import Logo from '@/shared/assets/logo.svg'

import { ChangePasswordForm } from './change-password-form'

/**
 * Экран смены пароля — тот же макет, что у входа: человек попадает сюда сразу после входа,
 * и менять ему оформление на середине пути незачем.
 *
 * Показывается в двух случаях: администратор потребовал сменить пароль
 * (`ПотребоватьСменуПароляПриВходе` в 1С) — тогда сюда приводит гвард, — и по собственному
 * желанию из меню пользователя.
 */
export const ChangePasswordPage = () => {
  const { t } = useTranslation()
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)

  if (AUTH_ENABLED && status === 'anonymous') {
    return <Navigate to={LOGIN_ROUTE} replace />
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ui-02 p-6">
      <div className="relative z-10 w-full max-w-[810px] rounded-[24px] bg-ui-01 px-6 py-14 sm:px-24">
        <div className="mx-auto flex w-full max-w-[576px] flex-col items-center">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 shrink-0" aria-hidden />
            <Typography
              component="span"
              fontSize={20}
              fontWeight={700}
              color="text.primary"
            >
              {t('sidebar.appName')}
            </Typography>
          </div>

          <Typography
            component="h1"
            fontSize={40}
            fontWeight={700}
            lineHeight={1.15}
            color="text.primary"
            className="mt-11 text-center"
          >
            {t('auth.changePasswordTitle')}
          </Typography>

          {user?.mustChangePassword && (
            <Typography
              role="status"
              component="p"
              fontSize={14}
              fontWeight={500}
              color="text.secondary"
              className="mt-4 text-center"
            >
              {t('auth.mustChangePassword')}
            </Typography>
          )}

          <div className="mt-8 w-full">
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </div>
  )
}
