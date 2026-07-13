import { showToast } from '@/shared/ui/toast/show-toast'

import { fetchMovementsView } from '../api/movements-api'
import { openDialogAsPanel } from './open-dialog-panel'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

// ДтКт из формы списка: session-less GET /api/view/movements/{id} →
// openDialog-эффект → workspace-вкладка тем же путём, что showDtKt из формы.
// По контракту бэка эффект один: openDialog либо notify (нет движений /
// документ не найден) — панель в этом случае не открывается.
export async function openMovementsForEntry(entryId: string): Promise<void> {
  const res = await fetchMovementsView(entryId)
  for (const effect of res.effects ?? []) {
    if (effect.type === 'openDialog') {
      openDialogAsPanel(effect)
    } else if (effect.type === 'notify') {
      showToast((effect.level as ToastLevel) ?? 'info', effect.message ?? '')
    }
  }
}
