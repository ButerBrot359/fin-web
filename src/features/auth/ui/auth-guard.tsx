import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import {
  onPasswordChangeRequired,
  onSessionExpired,
} from '@/shared/api/auth/session-events'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import {
  AUTH_ENABLED,
  CHANGE_PASSWORD_ROUTE,
  LOGIN_ROUTE,
  REDIRECT_PARAM,
} from '../lib/consts/auth-config'
import { useAuthStore } from '../lib/hooks/use-auth-store'

interface AuthGuardProps {
  children: ReactNode
}

/**
 * Пускает к защищённым маршрутам только вошедшего пользователя.
 *
 * Пока `VITE_AUTH_ENABLED` не поднят, гвард прозрачен — но сессию всё равно восстанавливает
 * и на её конец подписывается: токен, если он есть, должен работать и в этом режиме,
 * иначе фронт не сможет переходить на аутентификацию постепенно.
 */
export const AuthGuard = ({ children }: AuthGuardProps) => {
  const location = useLocation()
  const status = useAuthStore((state) => state.status)
  const mustChangePassword = useAuthStore(
    (state) => state.user?.mustChangePassword ?? false
  )
  const restore = useAuthStore((state) => state.restore)
  const handleSessionExpired = useAuthStore(
    (state) => state.handleSessionExpired
  )

  useEffect(() => {
    restore()
  }, [restore])

  useEffect(
    () => onSessionExpired(handleSessionExpired),
    [handleSessionExpired]
  )

  // SCRUM-400 §4.3: сервер потребовал смену пароля ПОСЛЕ входа (точный message
  // фильтра пойман интерсептором) — сохранённый пользователь ещё с
  // mustChangePassword=false, поэтому признак дублируется локальным флагом.
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false)
  useEffect(
    () =>
      onPasswordChangeRequired(() => {
        setPasswordChangeRequired(true)
      }),
    []
  )

  if (!AUTH_ENABLED) {
    return <>{children}</>
  }

  // Хранилище ещё не прочитано. Показать здесь экран входа значило бы «мигать» логином
  // при каждой перезагрузке уже вошедшему пользователю.
  if (status === 'unknown') {
    return <PageSkeleton />
  }

  if (status === 'anonymous') {
    // Куда человек шёл — запоминаем в query, чтобы после входа вернуть его туда же, а не
    // на главную. Путь сохраняем целиком, вместе с query и хешем.
    const from = `${location.pathname}${location.search}${location.hash}`
    const target = `${LOGIN_ROUTE}?${REDIRECT_PARAM}=${encodeURIComponent(from)}`
    return <Navigate to={target} replace />
  }

  // Пароль потребовали сменить — остальное приложение всё равно закрыто сервером (403,
  // ТЗ §А5). Ведём на смену пароля сами, иначе человек видел бы пустые экраны с отказами и
  // не понимал, чего от него хотят.
  if (mustChangePassword || passwordChangeRequired) {
    return <Navigate to={CHANGE_PASSWORD_ROUTE} replace />
  }

  return <>{children}</>
}
