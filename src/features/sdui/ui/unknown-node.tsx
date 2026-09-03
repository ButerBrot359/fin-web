import type { FC } from 'react'
import { Typography } from '@mui/material'

import type { NodeProps } from '../types/view'
import { cssVar, palette } from '@/shared/design/tokens'

export const UnknownNode: FC<NodeProps> = ({ node }) => (
  <div
    style={{
      padding: 8,
      border: `1px dashed ${cssVar(palette.pendingWarnBorder)}`,
      background: cssVar(palette.pendingWarnBg),
      borderRadius: 4,
    }}
  >
    <Typography variant="caption">
      Тип «{node.type}» не поддерживается этой версией клиента (id: {node.id}).
    </Typography>
  </div>
)
