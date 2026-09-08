import type { ReactNode } from 'react'
import { Typography } from '@mui/material'

import { cssVar, semantic } from '@/shared/design/tokens'
import { cn } from '@/shared/lib/utils/cn'

interface MicroLabelProps {
  children: ReactNode
  className?: string
}

/**
 * Мелкая подпись над значением: разрядка, капитель, приглушённый цвет.
 *
 * Размер, вес и трекинг заданы пропами MUI, а не Tailwind-классами, и это
 * важно: Tailwind v4 держит утилиты в `@layer utilities`, а emotion-стили
 * `Typography` живут вне слоёв и выигрывают у них по каскаду. Класс
 * `text-[11px]` на `<Typography>` молча проигрывает `MuiTypography-body1`,
 * и подпись остаётся 16-м кеглем — получается обычный текст капслоком.
 *
 * Один компонент на весь раздел «Аналитика»: подпись повторяется в виджетах,
 * ассистенте, параметрах и настройках, и три копии одной формулы разъезжаются
 * при первой же правке.
 */
export const MicroLabel = ({ children, className }: MicroLabelProps) => (
  <Typography
    component="span"
    fontSize={11}
    fontWeight={600}
    lineHeight={1.4}
    letterSpacing="0.08em"
    textTransform="uppercase"
    className={cn('text-ui-05', className)}
  >
    {children}
  </Typography>
)

/** Та же формула для мест, где подпись рисует не `MicroLabel`, а `sx` соседа. */
export const MICRO_LABEL_SX = {
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.4,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: cssVar(semantic.textSecondary),
} as const
