import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'

import type { NodeProps } from '../types/view'
import { cssVar, palette } from '@/shared/design/tokens'

export const UnknownNode: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  return (
    <div
      style={{
        padding: 8,
        border: `1px dashed ${cssVar(palette.pendingWarnBorder)}`,
        background: cssVar(palette.pendingWarnBg),
        borderRadius: 4,
      }}
    >
      <Typography variant="caption">
        {t('sdui.unknownNode', { type: node.type, id: node.id })}
      </Typography>
    </div>
  )
}
