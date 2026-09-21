import type { FC, ReactElement } from 'react'
import { Tooltip } from '@mui/material'

interface DisabledReasonTooltipProps {
  /** Причина недоступности; нет причины → детей рендерим без обёртки. */
  reason: string | undefined
  /**
   * Блочная обёртка для растянутых на строку полей: inline-flex схлопнул бы
   * fullWidth-контрол. Кнопкам и пунктам меню достаточно inline-flex.
   */
  block?: boolean
  children: ReactElement
}

/**
 * SCRUM-308 §3.1: причина недоступности погашенного элемента. Одна обёртка на
 * все узлы («как показывается причина» — одно решение, не пять): отключённый
 * MUI-контрол не испускает mouse-события, поэтому цель наведения — span.
 */
export const DisabledReasonTooltip: FC<DisabledReasonTooltipProps> = ({
  reason,
  block = false,
  children,
}) => {
  if (!reason) return children
  return (
    <Tooltip title={reason}>
      <span style={block ? { display: 'block' } : { display: 'inline-flex' }}>
        {children}
      </span>
    </Tooltip>
  )
}
