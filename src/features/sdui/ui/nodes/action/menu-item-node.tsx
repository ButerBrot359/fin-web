import type { FC } from 'react'
import { MenuItem } from '@mui/material'

import type { ActionBehavior, NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const MenuItemNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined

  // props.behavior побеждает action.behavior (SCRUM-283 §2.5)
  const clickBehavior =
    node.actions?.find((a) => a.trigger === 'click')?.behavior ?? null
  const behavior =
    (node.props?.behavior as ActionBehavior | undefined) ?? clickBehavior

  const dispatch = useSduiDispatch()

  const handleClick = () => {
    if (command) {
      void dispatch({ type: 'COMMAND', command }, behavior)
    }
  }

  return <MenuItem onClick={handleClick}>{label}</MenuItem>
}
