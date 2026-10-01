import { cssVar, palette, semantic } from '@/shared/design/tokens'

export interface ItogiTextStyle {
  fontWeight: number
  fontSize: number
  color: string
}

const TEXT = cssVar(semantic.textPrimary)
const LARGE = 13
const SMALL = 11

export const ITOGI_HEADER_TEXT: ItogiTextStyle = {
  fontWeight: 700,
  fontSize: LARGE,
  color: TEXT,
}

export const ITOGI_HEADER_BACKGROUND = cssVar(palette.ui08)

export const ITOGI_GRID_LINE = cssVar(semantic.divider)

export function itogiRowText(stil: unknown): ItogiTextStyle {
  switch (stil) {
    case 'L1':
    case 'ITOGO':
      return { fontWeight: 700, fontSize: LARGE, color: TEXT }
    case 'L2':
      return { fontWeight: 700, fontSize: SMALL, color: TEXT }
    default:
      return { fontWeight: 400, fontSize: SMALL, color: TEXT }
  }
}

export function itogiRowBackground(stil: unknown): string {
  switch (stil) {
    case 'ITOGO':
      return ITOGI_HEADER_BACKGROUND
    case 'L1':
      return cssVar(palette.ui04)
    case 'L2':
    case 'L3':
      return cssVar(semantic.zebra)
    default:
      return cssVar(semantic.surface)
  }
}
