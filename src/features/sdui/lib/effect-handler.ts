import type { NavigateFunction } from 'react-router-dom'

import i18n from '@/app/config/i18n'
import { apiService } from '@/shared/api/api'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect } from '../types/view'
import { parseContentDispositionFilename } from './parse-content-disposition'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

export interface EffectHandlerDeps {
  navigate: NavigateFunction
  closeSession: () => Promise<void>
  openDialog: (effect: ViewEffect) => void
  closeDialog: (effect: ViewEffect) => void
  invalidateLists: () => void
}

export function createEffectHandler(deps: EffectHandlerDeps) {
  function play(effect: ViewEffect): void {
    switch (effect.type) {
      case 'navigate':
        void deps.closeSession()
        deps.navigate(effect.route!)
        break

      case 'openDialog':
        deps.openDialog(effect)
        break

      case 'closeDialog':
        deps.closeDialog(effect)
        break

      case 'notify':
        showToast(
          (effect.level as ToastLevel) ?? 'info',
          effect.message ?? '',
        )
        break

      case 'refresh':
        // Списки (LIST-ноды) перечитываются через TanStack Query. Payload
        // эффекта игнорируем намеренно: адресация не подтверждена контрактом
        // (вопрос Talgat'у в спеке v2) — инвалидация всех SDUI-списков безопасна.
        deps.invalidateLists()
        break

      case 'download': {
        if (!effect.url) break
        void apiService
          .getFileBlob({ url: effect.url })
          .then((res) => {
            const objectUrl = URL.createObjectURL(res.data)
            const disposition = res.headers['content-disposition'] as
              | string
              | undefined

            if (disposition && /attachment/i.test(disposition)) {
              // Сервер требует сохранение на диск (§3.5 SCRUM-268)
              const a = document.createElement('a')
              a.href = objectUrl
              a.download =
                parseContentDispositionFilename(disposition) || 'download'
              document.body.appendChild(a)
              a.click()
              a.remove()
            } else {
              // inline или без заголовка — превью в новой вкладке (как раньше)
              window.open(objectUrl, '_blank')
            }
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
          })
          .catch(() => showToast('error', i18n.t('sdui.downloadError')))
        break
      }
    }
  }

  function playAll(effects: ViewEffect[]): void {
    effects.forEach(play)
  }

  return { play, playAll }
}
