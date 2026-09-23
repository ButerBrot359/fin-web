import type { FC, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import Logo from '@/shared/assets/logo.svg'

/**
 * Карточка экранов восстановления пароля — тот же макет, что у входа и смены
 * пароля: человек приходит сюда с экрана входа, менять оформление незачем.
 */
export const RecoveryCard: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => {
  const { t } = useTranslation()
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
            {title}
          </Typography>

          <div className="mt-8 w-full">{children}</div>
        </div>
      </div>
    </div>
  )
}
