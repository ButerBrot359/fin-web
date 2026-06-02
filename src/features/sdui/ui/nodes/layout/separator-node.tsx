import type { FC } from 'react'
import { Divider } from '@mui/material'

import type { NodeProps } from '../../../types/view'

export const SeparatorNode: FC<NodeProps> = ({ node }) => {
  const orientation = (node.props?.orientation as 'horizontal' | 'vertical' | undefined) ?? 'horizontal'

  return <Divider orientation={orientation} flexItem />
}
