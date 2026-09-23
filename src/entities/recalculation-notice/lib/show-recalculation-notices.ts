import { showToast } from '@/shared/ui/toast/show-toast'

import type { RecalculationNotice } from '../types/recalculation-notice'

// Тип тостов не экспортируется из shared — локальный литерал, как в effect-handler
type ToastLevel = 'success' | 'error' | 'info' | 'warning'

/**
 * Показ уведомлений о пересчёте вне SDUI (REST-тулбар, вотчер фоновых задач) —
 * тот же паттерн, что notify с route в effect-handler: кликабельный тост,
 * переход только по клику; запись в историю оповещений делает сам showToast
 * (onToastShown, канал №8 SCRUM-317). Порядок вызова — ПОСЛЕ штатного
 * success-тоста: «успех → предупреждение» (handoff §3.6, пакет Д п.1).
 */
export function showRecalculationNotices(
  notices: RecalculationNotice[] | null | undefined,
  navigate: (route: string) => void
): void {
  for (const notice of notices ?? []) {
    const route = notice.route
    showToast(notice.level as ToastLevel, notice.message, undefined, {
      route: route ?? null,
      onClick: route
        ? () => {
            navigate(route)
          }
        : undefined,
    })
  }
}
