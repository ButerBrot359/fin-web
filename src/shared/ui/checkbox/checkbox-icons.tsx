import { SvgIcon } from '@mui/material'

import { cssVar, palette } from '@/shared/design/tokens'

/**
 * Глифы чекбокса по Figma (форма документа 772:24370, чекбокс 24×24):
 * рамка и галка — currentColor (цветом управляет MuiCheckbox в теме),
 * заливка checked/indeterminate — салатовый Accent 01. MUI-дефолт рисовал
 * синий квадрат с белой галкой — в макетах такого состояния нет.
 * SvgIcon (а не сырой svg): наследует size="small" и цветовые классы MUI.
 */

const Frame = ({ fill }: { fill: string }) => (
  <rect
    x="1"
    y="1"
    width="22"
    height="22"
    rx="6"
    fill={fill}
    stroke="currentColor"
    strokeWidth="2"
  />
)

export const CheckboxBlankIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fill: 'none' }}>
    <Frame fill={cssVar(palette.ui01)} />
  </SvgIcon>
)

export const CheckboxCheckedIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fill: 'none' }}>
    <Frame fill={cssVar(palette.accent01)} />
    <path
      d="M7 12.5l3.4 3.4 6.6-7.8"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </SvgIcon>
)

export const CheckboxIndeterminateIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fill: 'none' }}>
    <Frame fill={cssVar(palette.accent01)} />
    <path
      d="M7 12h10"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      fill="none"
    />
  </SvgIcon>
)
