import type { FC } from 'react'
import { MenuItem } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'

export const MenuItemNode: FC<NodeProps> = ({ node }) => {
  const label = node.props?.label as string | undefined
  const command = node.props?.command as string | undefined

  const dispatch = useSduiDispatch()

  const handleClick = () => {
    if (command) {
      void dispatch({ type: 'COMMAND', command })
    }
  }

  return <MenuItem onClick={handleClick}>{label}</MenuItem>
}
