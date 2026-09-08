import type { ReactNode } from 'react'

import type { AnalyticsWidgetPosition } from '@/entities/analytics'

export interface WidgetGridItemProps {
  position: AnalyticsWidgetPosition
  children: ReactNode
}

const span = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) : 1

const start = (value: number): number =>
  Number.isFinite(value) && value > 0 ? Math.floor(value) + 1 : 1

/**
 * Позиция одного виджета в сетке дашборда. Координаты в спецификации
 * нумеруются с нуля, CSS-grid — с единицы.
 */
export const WidgetGridItem = ({ position, children }: WidgetGridItemProps) => (
  <div
    className="min-h-0 min-w-0"
    style={{
      gridColumn: `${String(start(position.x))} / span ${String(span(position.w))}`,
      gridRow: `${String(start(position.y))} / span ${String(span(position.h))}`,
    }}
  >
    {children}
  </div>
)
