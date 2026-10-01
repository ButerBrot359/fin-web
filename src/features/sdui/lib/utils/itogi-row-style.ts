import { cssVar, palette } from '@/shared/design/tokens'

export interface ItogiTextStyle {
  fontWeight: number
  fontSize: number
  color?: string
}

const GREEN = cssVar(palette.pending1cGreen)
const LARGE = 13
const SMALL = 11

export const ITOGI_HEADER_TEXT: ItogiTextStyle = {
  fontWeight: 700,
  fontSize: LARGE,
  color: GREEN,
}

export const ITOGI_HEADER_BACKGROUND = cssVar(palette.pending1cHeaderBg)

export const ITOGI_GRID_LINE = cssVar(palette.pending1cGridLine)

export function itogiRowText(stil: unknown): ItogiTextStyle {
  switch (stil) {
    case 'L1':
    case 'ITOGO':
      return { fontWeight: 700, fontSize: LARGE, color: GREEN }
    case 'L2':
      return { fontWeight: 700, fontSize: SMALL, color: GREEN }
    default:
      return { fontWeight: 400, fontSize: SMALL }
  }
}
