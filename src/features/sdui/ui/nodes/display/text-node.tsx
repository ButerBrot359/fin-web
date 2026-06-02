import type { FC } from 'react'
import { Typography } from '@mui/material'

import type { NodeProps } from '../../../types/view'

export const TextNode: FC<NodeProps> = ({ node }) => {
  const text = (node.props?.text as string | undefined) ?? ''

  return <Typography variant="body2">{text}</Typography>
}
