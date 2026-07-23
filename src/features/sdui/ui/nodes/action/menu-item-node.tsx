import type { FC } from 'react'
import { MenuItem, Tooltip } from '@mui/material'

import type { ActionBehavior, NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const MenuItemNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined
  // Заглушки-команды приходят disabled + tooltip-причиной (SCRUM-265 FE-2) —
  // как и BUTTON верхнего ряда; пункт не должен быть кликабельным.
  const enabled = (node.props?.enabled as boolean | undefined) ?? true
  const tooltip = node.props?.tooltip as string | undefined

  // props.behavior побеждает action.behavior (SCRUM-283 §2.5)
  const clickBehavior =
    node.actions?.find((a) => a.trigger === 'click')?.behavior ?? null
  const behavior =
    (node.props?.behavior as ActionBehavior | undefined) ?? clickBehavior

  const dispatch = useSduiDispatch()

  const handleClick = () => {
    if (!enabled) return
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
