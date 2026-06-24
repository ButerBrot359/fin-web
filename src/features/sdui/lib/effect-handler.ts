import type { NavigateFunction } from 'react-router-dom'

import { apiService } from '@/shared/api/api'
import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect } from '../types/view'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

export interface EffectHandlerDeps {
  navigate: NavigateFunction
  closeSession: () => Promise<void>
  openDialog: (effect: ViewEffect) => void
  closeDialog: (effect: ViewEffect) => void
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

      case 'download': {
        if (!effect.url) break
        void apiService
          .getFileBlob({ url: effect.url })
          .then((res) => {
            const objectUrl = URL.createObjectURL(res.data)
            window.open(objectUrl, '_blank')
            setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
          })
          .catch(() =>
            showToast('error', 'Не удалось сформировать печатную форму'),
          )
        break
      }
    }
  }

  function playAll(effects: ViewEffect[]): void {
    effects.forEach(play)
  }

  return { play, playAll }
}
