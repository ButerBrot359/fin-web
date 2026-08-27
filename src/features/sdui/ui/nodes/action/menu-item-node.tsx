import type { FC } from 'react'
import { MenuItem, Tooltip } from '@mui/material'

import type { ActionBehavior, NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useSduiEffects } from '../../../lib/use-sdui-effects'
import { useMenuClose } from './menu-close-context'

export const MenuItemNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  // Заглушки-команды приходят disabled + tooltip-причиной (SCRUM-265 FE-2) —
  // как и BUTTON верхнего ряда; пункт не должен быть кликабельным.
  // SCRUM-362 B-4: enabled эмитится бэком явно — строгая проверка вместо ?? true.
  const enabled = node.props?.enabled === true
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

  const dispatch = useSduiDispatch()
  const effects = useSduiEffects()
  const closeMenu = useMenuClose()

  const handleClick = () => {
    if (!enabled) return
    // SCRUM-276 spec v1 §6: закрыть меню ДО диспатча — серверный confirm
    // не должен оказаться под backdrop'ом меню.
    closeMenu?.()
    if (requestAction) {
      void effects.executeActionRequest(requestAction)
      return
    }
    if (command) {
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
