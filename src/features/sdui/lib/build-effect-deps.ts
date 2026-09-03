import type { NavigateFunction } from 'react-router-dom'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateDictionaryQueries } from '@/shared/lib/query/invalidate-entities'

import { viewTransport } from '../api/view-transport'
import type { EffectHandlerDeps } from './effect-handler'
import { openDialogAsPanel } from './open-dialog-panel'
import type { SduiSessionValue } from './sdui-session-context'
import { armNewTab } from './workspace-tab-gateway'
import { markFreshFormInstance } from '@/features/workspace-tabs/lib/fresh-form-instance-registry'
import { isCreateRoute } from './fresh-form-instance'

export interface EffectDepsCtx {
  navigate: NavigateFunction
  session: SduiSessionValue
  queryClient: QueryClient
  setSearchParams: (search: string, opts?: { replace?: boolean }) => void
}

// SCRUM-288: общая часть зависимостей эффект-хэндлера (без confirm/closeDialog/
// unsavedChanges — они ссылаются на сам хэндлер либо на dispatch и строятся на
// месте вызова). Используют dispatch и use-sdui-effects.
// closeSession/openDialog читают сессию ЛЕНИВО (в момент проигрывания).
export function buildCommonEffectDeps(
  ctx: EffectDepsCtx
): Omit<EffectHandlerDeps, 'confirm' | 'closeDialog' | 'unsavedChanges'> {
  return {
    // Переход на форму создания («Создать», копия, ввод на основании) начинает НОВЫЙ
    // экземпляр формы: клиентский снимок вкладки снимается, а следующий OPEN уйдёт с новым
    // formInstanceId — иначе в новом документе всплыли бы значения прошлого черновика.
    navigate: ((to: Parameters<NavigateFunction>[0], opts?: unknown) => {
      if (typeof to === 'string' && isCreateRoute(to)) markFreshFormInstance(to)
      ;(ctx.navigate as (t: unknown, o?: unknown) => void)(to, opts)
    }) as NavigateFunction,
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
      // SDUI-списки (LIST-нода, list-node.tsx) — часть контракта, не трогаем.
      void ctx.queryClient.invalidateQueries({ queryKey: ['sdui-list'] })
      // Экран списка справочника на проде ещё легаси (kill switch
      // sdui.list-form.enabled-types), а карточка уже SDUI: после записи из
      // SDUI-карточки refresh обязан освежить и легаси-кэши справочника
      // (список, сайдбар, ссылочные пикеры), иначе список показывает старое.
      invalidateDictionaryQueries(ctx.queryClient)
    },
    openRouteInNewTab: (route) => {
      // armNewTab взводится ДО navigate — см. dispatch (редирект между OPEN и целью)
      armNewTab()
      if (isCreateRoute(route)) markFreshFormInstance(route)
      void ctx.navigate(route)
    },
    replaceUrl: (route) => {
      const i = route.indexOf('?')
      ctx.setSearchParams(i >= 0 ? route.slice(i + 1) : '', { replace: true })
    },
  }
}
