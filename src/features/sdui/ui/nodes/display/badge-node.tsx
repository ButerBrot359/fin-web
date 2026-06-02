import type { FC } from 'react'
import { Chip } from '@mui/material'

import type { NodeProps } from '../../../types/view'

type BadgeColor = 'default' | 'success' | 'warning' | 'error' | 'info'

const COLOR_MAP: Record<string, BadgeColor> = {
  default: 'default',
  success: 'success',
  warning: 'warning',
  error: 'error',
  info: 'info',
}

export const BadgeNode: FC<NodeProps> = ({ node }) => {
  const text = (node.props?.text as string | undefined) ?? ''
  const colorProp = (node.props?.color as string | undefined) ?? 'default'
  const color = COLOR_MAP[colorProp] ?? 'default'

  return <Chip size="small" label={text} color={color} />
}
