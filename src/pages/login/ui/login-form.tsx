import { useState, type SyntheticEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { TextField, Typography } from '@mui/material'

import { useAuthStore, REDIRECT_PARAM } from '@/features/auth'
import { clearLastLogin, getLastLogin } from '@/shared/api/auth/token-storage'
import { Button } from '@/shared/ui/buttons/button'

import { extractAuthError } from '../lib/extract-auth-error'

/**
 * Форма входа: логин, пароль, отказ.
 *
 * ⚠️ Оформление временное. Вёрстка по макету Figma (нода 545:22859) — отдельный шаг:
 * на момент написания доступ к Dev Mode файла отсутствовал. Разметка намеренно плоская,
 * чтобы её замена не задела поведение: состояние, отправка и обработка ошибок живут здесь
 * и от оформления не зависят.
 */
export const LoginForm = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const signIn = useAuthStore((state) => state.signIn)

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
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUseAnotherAccount = () => {
    clearLastLogin()
    setLogin('')
    setPassword('')
    setError(null)
  }

  const isSubmitDisabled = isSubmitting || !login.trim() || !password

  return (
    <form
      onSubmit={(event) => {
        // `void` обязателен: обработчик асинхронный, а onSubmit ждёт void —
        // иначе повисший промис остаётся без обработчика отказа.
        void handleSubmit(event)
      }}
      className="flex w-full flex-col gap-4"
    >
      <TextField
        label={t('auth.loginLabel')}
        value={login}
        onChange={(event) => {
          setLogin(event.target.value)
        }}
        autoComplete="username"
        autoFocus={!login}
        error={!!error}
        // Подсказка про пробелы не косметика: логин в 1С — это «Фамилия Имя», и без неё
        // человек пытается ввести одно слово или латиницу.
        helperText={t('auth.loginHint')}
        disabled={isSubmitting}
      />

      <TextField
        label={t('auth.passwordLabel')}
        type="password"
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
        }}
        autoComplete="current-password"
        autoFocus={!!login}
        error={!!error}
        disabled={isSubmitting}
      />

      {error && (
        <Typography role="alert" color="error" variant="body2">
          {error}
        </Typography>
      )}

      <Button type="submit" variant="primary" disabled={isSubmitDisabled}>
        {isSubmitting ? t('auth.submitting') : t('auth.submit')}
      </Button>

      {!!getLastLogin() && (
        <Button variant="tertiary" onClick={handleUseAnotherAccount}>
          {t('auth.useAnotherAccount')}
        </Button>
      )}
    </form>
  )
}
