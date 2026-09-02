import type { FC } from 'react'
import { MenuItem, Tooltip } from '@mui/material'

import type { ActionBehavior, NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useSelection } from '../../../lib/stores/selection-store'
import { useSduiEffects } from '../../../lib/use-sdui-effects'
import { useMenuClose } from './menu-close-context'

export const MenuItemNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  // Заглушки-команды приходят disabled + tooltip-причиной (SCRUM-265 FE-2) —
  // как и BUTTON верхнего ряда; пункт не должен быть кликабельным.
  // SCRUM-362 B-4: enabled эмитится бэком явно — строгая проверка вместо ?? true.
  const enabledByServer = node.props?.enabled === true
  const tooltip = node.props?.tooltip as string | undefined

  const clickAction = node.actions?.find((a) => a.trigger === 'click')
  // props.behavior побеждает action.behavior (SCRUM-283 §2.5)
  const behavior =
    (node.props?.behavior as ActionBehavior | undefined) ??
    clickAction?.behavior ??
    null
  // SCRUM-277 §13.12: готовый request на click-действии (пункт «По
  // классификатору...») — исполняется эффект-рантаймом, command в той же
  // ветке НЕ диспатчится. URL непрозрачен, фронт его не разбирает.
  const requestAction = clickAction?.request ?? null

  // Пункт меню, работающий с ВЫДЕЛЕННОЙ строкой списка («Создать на основании»,
  // печатная форма, зеркала команд строки в «Ещё»), объявляет это теми же полями
  // click-действия, что и BUTTON: фронт имя команды не парсит. До 02.09.2026 пункт их
  // игнорировал и слал COMMAND без value — сервер отвечал «Не выбрана строка списка»
  // даже на выделенной строке.
  const requiresSelectedRow = clickAction?.requiresSelectedRow === true
  const selectionField = clickAction?.selectionField ?? undefined
  const selectedRowId = useSelection(
    requiresSelectedRow ? (selectionField ?? null) : null
  )
  const enabled =
    enabledByServer && !(requiresSelectedRow && selectedRowId == null)

  const dispatch = useSduiDispatch()
  const effects = useSduiEffects()
  const closeMenu = useMenuClose()

  const handleClick = () => {
    if (!enabled) return
    // SCRUM-276 spec v1 §6: закрыть меню ДО диспатча — серверный confirm
    // не должен оказаться под backdrop'ом меню.
    closeMenu?.()
    if (requestAction) {
      // Выделенная строка передаётся ТОЛЬКО когда пункт её требует — иначе форма вызова
      // остаётся прежней (у пунктов-request'ов сегодня выделения нет).
      if (requiresSelectedRow) {
        void effects.executeActionRequest(
          requestAction,
          selectedRowId ?? undefined
        )
      } else {
        void effects.executeActionRequest(requestAction)
      }
      return
    }
    if (command) {
      if (requiresSelectedRow) {
        void dispatch(
          {
            type: 'COMMAND',
            command,
            value: { id: selectedRowId },
            sourceNodeId: node.id,
          },
          behavior
        )
        return
      }
      void dispatch({ type: 'COMMAND', command }, behavior)
    }
  }

  const item = (
    <MenuItem onClick={handleClick} disabled={!enabled}>
      {label}
    </MenuItem>
  )

  return tooltip ? (
    // span-обёртка обязательна: без неё tooltip не работает на disabled-пункте
    <Tooltip title={tooltip}>
      <span style={{ display: 'block' }}>{item}</span>
    </Tooltip>
  ) : (
    item
  )
}
