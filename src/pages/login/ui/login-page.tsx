import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { useAuthStore } from '@/features/auth'
import Logo from '@/shared/assets/logo.svg'

import { LoginForm } from './login-form'

/**
 * Экран входа по макету Figma (нода 545:22859).
 *
 * Цвета взяты из токенов проекта, а не подобраны по картинке: фон и заливка полей —
 * `ui-02` (`#f2f6fd`), кнопка — `accent-01` (`#daf449`), она же цвет логотипа, серый
 * текст — `ui-05`. Макет и `tailwind.config.ts` совпали.
 *
 * <b>Иллюстрации из макета здесь нет.</b> Девушка с ноутбуком, собака, растение и лампы —
 * отдельные векторные объекты, выгрузить их можно только из самого файла Figma, а доступа
 * к нему нет. Слой под неё размечен ниже: когда SVG появится, она кладётся фоном и
 * компоновка карточки не меняется.
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ui-02 p-6">
      {/*
        Слот под иллюстрацию макета. Она декоративная и лежит ПОД карточкой: на узких
        экранах карточка перекрывает её целиком, и это правильный порядок — форма важнее.
      */}

      <div className="relative z-10 w-full max-w-[810px] rounded-[24px] bg-ui-01 px-6 py-14 sm:px-24">
        <div className="mx-auto flex w-full max-w-[576px] flex-col items-center">
          <div className="flex items-center gap-3">
            <Logo className="h-8 w-8 shrink-0" aria-hidden />
            {/*
              Размеры и цвета заданы пропсами Typography, а не классами Tailwind:
              Emotion-стили MUI перебивают утилитарные классы, и текст молча остаётся
              дефолтным 16px/400 — как это и случилось на первом заходе.
            */}
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
            className="mt-11"
          >
            {t('auth.title')}
          </Typography>

          <Typography
            component="p"
            fontSize={14}
            fontWeight={500}
            color="text.secondary"
            className="mt-4"
          >
            {t('auth.instanceLabel')}
          </Typography>

          <div className="mt-8 w-full">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  )
}
