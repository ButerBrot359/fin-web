import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import {
  buildCommonEffectDeps,
  buildDialogEffectDeps,
} from './build-effect-deps'
import { createEffectHandler } from './effect-handler'
import { useSduiSession } from './sdui-session-context'
import { useConfirmStore } from './stores/confirm-store'

// SCRUM-288: эффект-рантайм для нод (button-node, report-result-node). В отличие
// от dispatch: confirm обслуживает ТОЛЬКО confirmRequest (панель session-less —
// диспатчить command в неё некуда).
export function useSduiEffects() {
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const session = useSduiSession()

  const common = buildCommonEffectDeps({
    navigate,
    session,
    queryClient,
    setSearchParams,
  })
  const handler: ReturnType<typeof createEffectHandler> = createEffectHandler({
    ...common,
    // Мосты закрытия/замены панели — общие с dispatch (build-effect-deps).
    ...buildDialogEffectDeps({
      session,
      playAll: (effects) => {
        handler.playAll(effects)
      },
    }),
    confirm: (effect) => {
      void useConfirmStore
        .getState()
        .ask(effect.message ?? '')
        .then((ok) => {
          if (ok && effect.confirmRequest) {
            void handler.executeActionRequest(effect.confirmRequest)
          }
        })
    },
    // Вопрос «Сохранить изменения?» задаёт форма с СЕССИЕЙ (её несохранённое
    // лежит в этой сессии), а ответы — команды в неё же. У session-less нод
    // диспатчить их некуда, поэтому здесь эффект осознанно не поддержан:
    // сервер его сюда и не шлёт.
    unsavedChanges: () => {
      console.warn('[sdui] эффект unsavedChanges вне form-сессии — игнорируем')
    },
  })
  return handler
}
