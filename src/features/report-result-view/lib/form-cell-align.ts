import type { ReportColumnDto } from '@/pages/reports/report-list/types/report'

import { isRightAligned } from './cell-helpers'

const VERTICAL: Record<string, string> = {
  TOP: 'align-top',
  CENTER: 'align-middle',
  BOTTOM: 'align-bottom',
}

const HORIZONTAL: Record<string, string> = {
  LEFT: 'text-left',
  CENTER: 'text-center',
  RIGHT: 'text-right',
}

export const verticalAlignClass = (verticalAlign?: string): string =>
  VERTICAL[verticalAlign ?? ''] ?? 'align-top'

export const horizontalAlignClass = (
  col: ReportColumnDto,
  index: number,
  strict: boolean
): string => {
  const explicit = HORIZONTAL[col.align ?? '']
  if (strict && explicit) return explicit
  if (isRightAligned(col)) return 'text-right'
  return index === 0 ? 'text-center' : ''
}

export const labelAlignClass = (labelAlign?: string): string =>
  HORIZONTAL[labelAlign ?? ''] ?? 'text-right'
