import { useEffect } from 'react'

import { useSduiDispatch } from '../lib/dispatch'
import {
  registerPanelCloseHandler,
  unregisterPanelCloseHandler,
} from '../lib/panel-close-registry'
import type { ActionBehavior, ViewNode } from '../types/view'

interface PanelCloseCommandProps {
  panelId: string
  node: ViewNode
}

/**
 * Подписывает крестик панели на серверную команду закрытия
 * (`props.closeCommand` корня панели, см. `NodeProps.CLOSE_COMMAND`).
 *
 * Ничего не рисует: живёт внутри `SduiSessionProvider` панели ровно затем,
 * чтобы иметь её `dispatch` — `DialogHost`, который рисует крестик, находится
 * снаружи и командой в сессию панели выстрелить не может.
 *
 * Зачем вообще спрашивать сервер о закрытии: у формы в ДОЧЕРНЕЙ сессии
 * несохранённые правки лежат на сервере, а не в клиентском state. Панель,
 * закрытая одним лишь клиентом, оставляла их там — и следующее открытие той же
 * формы показывало их снова, как будто закрытие их сохранило.
 */
export const PanelCloseCommand = ({ panelId, node }: PanelCloseCommandProps) => {
  const dispatch = useSduiDispatch()
  const command = node.props?.closeCommand
  const behavior = node.props?.closeBehavior as ActionBehavior | undefined

  useEffect(() => {
    if (typeof command !== 'string' || command === '') return

    registerPanelCloseHandler(panelId, () => {
      // Закрывает панель СЕРВЕР (эффектом closeDialog) — здесь только отправка.
      // Локального «всё равно закроем, если команда не прошла» намеренно нет:
      // неуспех — это и не долетевший flush правок ТЧ, и отказ проверки
      // заполненности, и упавший запрос. Закрыть панель в любом из этих случаев
      // значило бы выбросить правки молча — ровно то, от чего задача и лечит.
      // Пользователь видит тост об ошибке и остаётся в окне.
      void dispatch({ type: 'COMMAND', command }, behavior)
    })
    return () => {
      unregisterPanelCloseHandler(panelId)
    }
  }, [panelId, command, behavior, dispatch])

  return null
}
