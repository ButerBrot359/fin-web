import type { FC } from 'react'
import { Typography } from '@mui/material'

import type { NodeProps } from '../types/view'

export const UnknownNode: FC<NodeProps> = ({ node }) => (
  <div
    style={{
      padding: 8,
      border: '1px dashed #f0a000',
      background: '#fff8e1',
      borderRadius: 4,
    }}
  >
    <Typography variant="caption">
      Тип «{node.type}» не поддерживается этой версией клиента (id: {node.id}).
    </Typography>
  </div>
)
