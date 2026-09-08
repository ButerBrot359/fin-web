import type { ReactNode } from 'react'

import type { AnalyticsLayout } from '@/entities/analytics'

export interface DashboardGridProps {
  layout: AnalyticsLayout
  children: ReactNode
}

const DEFAULT_COLUMNS = 12
const DEFAULT_ROW_HEIGHT = 80

/**
 * Сетка дашборда: колонки и высота ряда приходят в спецификации, позиции
 * виджетов расставляет {@link WidgetGridItem}.
 */
export const DashboardGrid = ({ layout, children }: DashboardGridProps) => {
  const columns =
    Number.isFinite(layout.columns) && layout.columns > 0
      ? Math.floor(layout.columns)
      : DEFAULT_COLUMNS
  const rowHeight =
    Number.isFinite(layout.rowHeight) && layout.rowHeight > 0
      ? layout.rowHeight
      : DEFAULT_ROW_HEIGHT

  return (
    <div
      className="grid w-full min-w-0 gap-4"
      style={{
        gridTemplateColumns: `repeat(${String(columns)}, minmax(0, 1fr))`,
        gridAutoRows: `${String(rowHeight)}px`,
      }}
    >
      {children}
    </div>
  )
}
