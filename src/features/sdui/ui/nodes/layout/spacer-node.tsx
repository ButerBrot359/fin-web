import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'

export const SpacerNode: FC<NodeProps> = (_props) => (
  <div style={{ flex: 1 }} />
)
