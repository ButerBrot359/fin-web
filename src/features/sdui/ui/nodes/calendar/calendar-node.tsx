import type { FC } from 'react'

import type { NodeProps } from '../../../types/view'
import type { CalendarNodeProps } from '../../../lib/calendar/calendar-types'
import type { ProductionCalendarNodeProps } from '../../../lib/calendar/production-calendar-types'
import { InclusionCalendarNode } from './inclusion-calendar-node'
import { ProductionCalendarNode } from './production/production-calendar-node'

// Узел CALENDAR — переключатель режимов (SCRUM-277 §13.3):
// mode=dayKind → производственный календарь (contract v2, server-side draft);
// иначе → график работы (inclusion, контракт B-2 без изменений).
export const CalendarNode: FC<NodeProps> = ({ node }) => {
  const mode =
    (node.props as CalendarNodeProps | undefined)?.mode ?? 'inclusion'

  if (mode === 'dayKind') {
    // key: локальные selection/dialog-состояния не переживают другой server
    // draft — смена draftId/версии/года пересоздаёт receiver с нуля.
    const p = node.props as ProductionCalendarNodeProps | undefined
    const draftKey = [
      p?.draftId ?? '',
      p?.draftVersion ?? '',
      p?.year ?? '',
    ].join(':')
    return <ProductionCalendarNode key={draftKey} node={node} />
  }

  return <InclusionCalendarNode node={node} />
}
