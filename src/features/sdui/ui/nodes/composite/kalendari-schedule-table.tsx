import { useState, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useBindingValue } from '../../../lib/sdui-session-context'
import type { TableRow } from '../../../lib/hooks/use-table-sync'
import { EditableTable } from './editable-table'
import { extractEditableColumns } from './table-node'
import { summarizeSchedule } from './kalendari-schedule-summary'

export const KalendariScheduleTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const rows = (useBindingValue(node.binding) as TableRow[] | undefined) ?? []
  const summary = summarizeSchedule(rows)
  const hasSchedule = rows.length > 0

  const handleExpand = (): void => {
    setExpanded(true)
  }

  if (expanded) {
    const columns = extractEditableColumns(node.children)
    return <EditableTable node={node} columns={columns} />
  }

  if (!hasSchedule) {
    return (
      <Button variant="outlined" size="small" onClick={handleExpand}>
        {t('sdui.kalendari.fillSchedule')}
      </Button>
    )
  }

  return (
    <Button variant="text" size="small" onClick={handleExpand}>
      {`${t('sdui.kalendari.schedule')}: ${String(summary.totalHours)} ч`}
    </Button>
  )
}
