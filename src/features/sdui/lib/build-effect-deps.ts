import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'

import { viewTransport } from '../api/view-transport'
import type { EffectHandlerDeps } from './effect-handler'
import { openDialogAsPanel } from './open-dialog-panel'
import type { SduiSessionValue } from './sdui-session-context'
import { armNewTab } from './workspace-tab-gateway'

export interface EffectDepsCtx {
  navigate: NavigateFunction
  session: SduiSessionValue
  queryClient: QueryClient
  setSearchParams: (search: string, opts?: { replace?: boolean }) => void
}

// SCRUM-288: общая часть зависимостей эффект-хэндлера (без confirm/closeDialog —
// они ссылаются на сам хэндлер и строятся на месте вызова). Используют dispatch и
// use-sdui-effects. closeSession/openDialog читают сессию ЛЕНИВО (в момент проигрывания).
export function buildCommonEffectDeps(
  ctx: EffectDepsCtx
): Omit<EffectHandlerDeps, 'confirm' | 'closeDialog'> {
  return {
    navigate: ctx.navigate,
    closeSession: async () => {
      const { formSessionId } = ctx.session.getSession()
      if (!formSessionId) return
      try {
        await viewTransport.post({ formSessionId, action: { type: 'CLOSE' } })
      } catch {
        // best-effort
      }
    },
    openDialog: (effect) => {
      openDialogAsPanel(
        effect,
        ctx.session.getSession().formSessionId ?? undefined
      )
    },
    invalidateLists: () => {
      void ctx.queryClient.invalidateQueries({ queryKey: ['sdui-list'] })
    },
    openRouteInNewTab: (route) => {
      // armNewTab взводится ДО navigate — см. dispatch (редирект между OPEN и целью)
      armNewTab()
      void ctx.navigate(route)
    },
    replaceUrl: (route) => {
      const i = route.indexOf('?')
      ctx.setSearchParams(i >= 0 ? route.slice(i + 1) : '', { replace: true })
    },
  }
}
