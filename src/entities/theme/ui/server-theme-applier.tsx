import { useEffect } from 'react'

import { useQuery } from '@tanstack/react-query'

import { applyServerTheme } from '@/shared/design/apply-server-theme'

import { themeApi } from '../api/theme-api'
import { themeKeys } from '../lib/query-keys'

/**
 * Тянет слитую тему пользователя и накатывает её на `:root` (конструктор
 * дизайна Ф3). Рендерит null — это провод, не UI.
 *
 * Монтируется под AuthGuard: до входа `/api/theme` отвечает 401, а дефолты
 * уже стоят из `injectDesignTokens`. Ошибка запроса — тихая деградация в
 * дефолтную тему, retry не нужен: тема не стоит шума при нестабильной сети.
 */
export const ServerThemeApplier = () => {
  const { data } = useQuery({
    queryKey: themeKeys.merged(),
    queryFn: ({ signal }) => themeApi.getTheme(signal),
    staleTime: Infinity,
    retry: false,
  })

  useEffect(() => {
    if (data) applyServerTheme(data)
  }, [data])

  return null
}
