import type { NavigateFunction } from 'react-router-dom'

import { showToast } from '@/shared/ui/toast/show-toast'

import type { ViewEffect } from '../types/view'

type ToastLevel = 'success' | 'error' | 'info' | 'warning'

export interface EffectHandlerDeps {
  navigate: NavigateFunction
  closeSession: () => Promise<void>
  openDialog: (effect: ViewEffect) => void
  closeDialog: (id: string) => void
  applyToParent?: (effect: ViewEffect) => void
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
        deps.closeDialog(effect.id!)
        break

      case 'notify':
        showToast(
          (effect.level as ToastLevel) ?? 'info',
          effect.message ?? '',
        )
        break

      case 'download':
        window.open(effect.url!, '_blank')
        break

      case 'applyToParent':
        deps.applyToParent?.(effect)
        break
    }
  }

  function playAll(effects: ViewEffect[]): void {
    effects.forEach(play)
  }

  return { play, playAll }
}
