import { ITOGI_GRID_LINE } from '../../../../lib/utils/itogi-row-style'

export const ITOGI_CELL_SX = {
  border: `1px solid ${ITOGI_GRID_LINE}`,
  px: 1,
  py: 0.5,
  lineHeight: 1.3,
  whiteSpace: 'nowrap',
} as const
