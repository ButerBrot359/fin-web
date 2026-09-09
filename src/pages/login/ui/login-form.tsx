import { useState, type SyntheticEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { Typography } from '@mui/material'

import { REDIRECT_PARAM, useAuthStore } from '@/features/auth'
import { FaceLoginButton } from '@/features/face-auth'
import { getLastLogin } from '@/shared/api/auth/token-storage'
import { Button } from '@/shared/ui/buttons/button'

import { extractAuthError } from '../lib/extract-auth-error'
import { LoginNameField } from './login-name-field'
import { LoginPasswordField } from './login-password-field'

/**
 * Форма входа: логин, пароль, отказ, кнопка.
 *
 * Текст отказа берётся с сервера и показывается дословно. В макете под полем пароля стоит
 * «Неверный пароль», но сервер на «нет такого логина» и «пароль неверен» отвечает ОДНИМ
 * текстом — «Неверный логин или пароль» (ТЗ §А1). Это не небрежность бэкенда: различающиеся
 * ответы позволяют перебором выяснить, какие учётные записи существуют, поэтому подставлять
 * здесь более конкретную формулировку нельзя.
 */
export const LoginForm = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const signIn = useAuthStore((state) => state.signIn)
  const completeSignIn = useAuthStore((state) => state.completeSignIn)
  const sessionExpired = useAuthStore((state) => state.sessionExpired)

  // Логин предзаполняется значением последнего успешного входа НА ЭТОМ УСТРОЙСТВЕ
  // (ТЗ §А1). Это единственный источник: серверного эндпоинта «кто заходил последним»
  // не существует — он раскрывал бы действующую учётку любому, кто открыл страницу.
  const [login, setLogin] = useState(getLastLogin)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: SyntheticEvent) => {
    event.preventDefault()
    if (isSubmitting) return

    setError(null)
    setSubmitting(true)
    try {
      // Логин уходит как есть: пробелы внутри («Иванов Иван») и регистр значимы для
      // пользователя, а нормализует их сервер. Клиентский trim здесь только создал бы
      // второе место с правилами нормализации.
      await signIn(login, password)
      const from = searchParams.get(REDIRECT_PARAM)
      // `void`: в react-router v7 navigate возвращает void | Promise<void>.
      void navigate(from ? decodeURIComponent(from) : '/', { replace: true })
    } catch (submitError) {
      setError(extractAuthError(submitError, t('auth.unavailable')))
      // Пароль стираем, логин оставляем: повторяют обычно только пароль.
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  // Figma 545:22859: в дефолте кнопка салатовая даже при пустых полях —
  // блокируется только на время запроса и в состоянии ошибки (серая ui-05,
  // пока поля не тронули; правка любого поля сбрасывает error и оживляет её).
  const isSubmitDisabled = isSubmitting || error !== null

  return (
    <form
      onSubmit={(event) => {
        // `void` обязателен: обработчик асинхронный, а onSubmit ждёт void —
        // иначе повисший промис остаётся без обработчика отказа.
        void handleSubmit(event)
      }}
      className="flex w-full flex-col items-center gap-4"
      noValidate
    >
      {/*
        Объяснение, почему человек здесь оказался. Без него обрыв сессии посреди работы
        выглядит как случайный выброс на форму входа: поля пусты, ошибки нет, причины нет.
        Показываем только пока не было своей ошибки входа — та конкретнее и важнее.
      */}
      {sessionExpired && !error && (
        <Typography
          role="status"
          variant="body2"
          color="text.secondary"
          className="w-full"
        >
          {t('auth.sessionExpired')}
        </Typography>
      )}

      <div className="flex w-full flex-col gap-4">
        <LoginNameField
          value={login}
          onChange={(next) => {
            setLogin(next)
            setError(null)
          }}
          hasError={!!error}
          disabled={isSubmitting}
          autoFocus={!login}
        />

        <LoginPasswordField
          value={password}
          onChange={(next) => {
            setPassword(next)
            setError(null)
          }}
          error={error}
          disabled={isSubmitting}
          autoFocus={!!login}
        />
      </div>

      {/* По макету (545:22859, x=367 при ширине 814) кнопка центрирована */}
      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitDisabled}
        className="mt-4"
      >
        {isSubmitting ? t('auth.submitting') : t('auth.submit')}
      </Button>

      {/* Вход по лицу — ДОПОЛНИТЕЛЬНЫЙ способ, а не замена паролю (ADR-0069 §D0). Он стоит
          ниже пароля намеренно: при недоступном движке распознавания, отказе камеры или
          светочувствительности пользователь обязан видеть работающий путь входа, а не
          выяснять, куда делся привычный. Кнопка сама уходит в неактивное состояние, пока не
          введён логин: серверу нужно знать, чей эталон сверять. */}
      <div className="mt-2 flex flex-col items-stretch gap-1">
        <FaceLoginButton
          login={login}
          disabled={isSubmitting}
          onSuccess={(tokens) => {
            completeSignIn(tokens, login)
            // Тот же разбор адреса возврата, что и у парольного входа выше, включая
            // decodeURIComponent: параметр кладут закодированным, и без раскодирования
            // человек после входа по лицу уезжал бы не туда, куда после входа паролем.
            const from = searchParams.get(REDIRECT_PARAM)
            void navigate(from ? decodeURIComponent(from) : '/', {
              replace: true,
            })
          }}
        />
      </div>
    </form>
  )
}
