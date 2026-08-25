import { useEffect, useRef } from 'react'
import i18n from 'i18next'

import { useSduiDispatch } from '../dispatch'
import { useSduiSession } from '../sdui-session-context'

/**
 * Запросы в полёте по ключу `formSessionId:nodeId` — модульный реестр, а не
 * state компонента: защищает от дублей при StrictMode-ремаунте и от повторного
 * кикоффа, когда дерево пересоздаётся патчами других нод во время загрузки.
 */
const inFlight = new Set<string>()

/**
 * Гидрация deferred-ноды (SCRUM-384): на маунте шлёт `HYDRATE {nodeIds:[id]}` —
 * по одной ноде на запрос, параллельно с другими deferred-нодами (§2.2 v2-back).
 * Ответ применяется существующим пайплайном dispatch (statePatch + patches),
 * `deferred` снимает бэк патчем setProp. Транспортный фейл (сеть/5xx) помечает
 * ноду `error` локально — бэковский фейл среза приходит таким же setProp с бэка.
 *
 * @returns ручной ретрай для кнопки «Повторить»: сбрасывает error и шлёт HYDRATE
 */
export function useHydrateNode(nodeId: string, hasError: boolean): () => void {
  const dispatch = useSduiDispatch()
  const session = useSduiSession()
  const startedRef = useRef(false)

  const hydrate = () => {
    const { formSessionId } = session.getSession()
    const key = `${formSessionId ?? ''}:${nodeId}`
    if (inFlight.has(key)) return
    inFlight.add(key)
    session.applyTreePatches([
      { op: 'setProp', nodeId, key: 'error', value: null },
    ])
    void dispatch({ type: 'HYDRATE', nodeIds: [nodeId] })
      .then((ok) => {
        if (!ok) {
          session.applyTreePatches([
            {
              op: 'setProp',
              nodeId,
              key: 'error',
              value: i18n.t('sdui.deferred.loadError'),
            },
          ])
        }
      })
      .finally(() => {
        inFlight.delete(key)
      })
  }

  // Кикофф ровно один раз на маунт (guard-ref вместо deps: dispatch/session
  // нестабильны по identity и зациклили бы эффект). Нода с ошибкой
  // не перезапрашивается автоматически — только кнопкой «Повторить».
  useEffect(() => {
    if (startedRef.current || hasError) return
    startedRef.current = true
    hydrate()
  })

  return hydrate
}
