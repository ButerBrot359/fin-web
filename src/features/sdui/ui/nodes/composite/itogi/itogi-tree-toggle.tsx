import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Box } from '@mui/material'

import { ITOGI_GRID_LINE } from '../../../../lib/utils/itogi-row-style'

const SIZE = 12

interface ItogiTreeToggleProps {
  expandable: boolean
  expanded: boolean
  onToggle: () => void
}

export const ItogiTreeToggle: FC<ItogiTreeToggleProps> = ({
  expandable,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation()
  if (!expandable) {
    return <Box component="span" sx={{ width: SIZE, flexShrink: 0 }} />
  }
  return (
    <Box
      component="span"
      role="button"
      aria-label={expanded ? t('table.collapseRow') : t('table.expandRow')}
      onClick={onToggle}
      sx={{
        width: SIZE,
        height: SIZE,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${ITOGI_GRID_LINE}`,
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {expanded ? '−' : '+'}
    </Box>
  )
}
