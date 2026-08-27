import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { onSessionExpired } from '@/shared/api/auth/session-events'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'

import {
  AUTH_ENABLED,
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

  return <>{children}</>
}
