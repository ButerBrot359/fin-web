import type { FC } from 'react'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/Delete'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'

import type { NodeProps } from '../../../types/view'

const ICON_MAP: Record<string, typeof AddIcon> = {
  Add: AddIcon,
  Close: CloseIcon,
  Delete: DeleteIcon,
  DeleteOutline: DeleteOutlineIcon,
  HelpOutline: HelpOutlineIcon,
}

export const IconNode: FC<NodeProps> = ({ node }) => {
  const name = (node.props?.name as string | undefined) ?? ''

  const Icon = ICON_MAP[name]
  if (!Icon) return null

  return <Icon />
}
