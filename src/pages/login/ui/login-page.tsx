import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { useAuthStore } from '@/features/auth'
import Logo from '@/shared/assets/logo.svg'
import DogIllustration from '@/shared/assets/illustrations/login/dog.svg'
import GirlIllustration from '@/shared/assets/illustrations/login/girl.svg'
import lampsUrl from '@/shared/assets/illustrations/login/lamps.svg?url'
import PlantIllustration from '@/shared/assets/illustrations/login/plant.svg'
import WindowIllustration from '@/shared/assets/illustrations/login/window.svg'

import { LoginForm } from './login-form'

/**
 * Экран входа по макету Figma (нода 545:22859).
 *
 * Цвета — токены проекта: фон и заливка полей `ui-02`, кнопка `accent-01`,
 * серый текст `ui-05`. Иллюстрация сцены (окно, девушка с ноутбуком, собака,
 * растение, лампы) выгружена из макета отдельными SVG; позиции — проценты от
 * фрейма 1920×1080, слой лежит ПОД карточкой: на узких экранах карточка
 * перекрывает декор целиком — форма важнее.
 */
// Порядок слоёв — как в Figma-фрейме: окно комнаты ПОД карточкой, персонажи
// (девушка, собака, растение) и лампы — ПОВЕРХ, «сидят» на окне ввода.
const UNDER_CARD_LAYERS = [
  { Svg: WindowIllustration, left: '9.6%', top: '8.5%', width: '27.6%' },
] as const

const OVER_CARD_LAYERS = [
  { Svg: GirlIllustration, left: '8.6%', top: '42.8%', width: '32.2%' },
  { Svg: DogIllustration, left: '43.3%', top: '70.5%', width: '12.1%' },
  // правее макетных 66.4%: на узких вьюпортах растение налезало на «Войти»
  { Svg: PlantIllustration, left: '71%', top: '55.9%', width: '17.5%' },
] as const
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
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden bg-ui-02 p-6">
      <div aria-hidden className="absolute inset-0">
        {UNDER_CARD_LAYERS.map(({ Svg, ...pos }, i) => (
          <Svg
            key={i}
            className="absolute h-auto"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          />
        ))}
      </div>
      {/* pointer-events-none: клики сквозь декор проходят в форму */}
      <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
        {OVER_CARD_LAYERS.map(({ Svg, ...pos }, i) => (
          <Svg
            key={i}
            className="absolute h-auto"
            style={{ left: pos.left, top: pos.top, width: pos.width }}
          />
        ))}
        {/* Лампы — <img>, не инлайн: этот единственный слой стабильно
            выпадал из скриншотов toHaveScreenshot при инлайн-рендере
            (контент SVG с отрицательными координатами внутри viewBox). */}
        <img
          src={lampsUrl}
          alt=""
          className="absolute h-auto"
          style={{ left: '74.5%', top: '0%', width: '10%' }}
        />
      </div>

      {/* Карточка прижата к верху, как в макете (y≈15% фрейма) */}
      <div className="relative z-10 mt-[12vh] w-full max-w-[810px] rounded-[24px] bg-ui-01 px-6 py-14 sm:px-24">
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
