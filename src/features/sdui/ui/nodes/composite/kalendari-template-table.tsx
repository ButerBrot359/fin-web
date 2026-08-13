import { type FC } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useBindingValue } from '../../../lib/sdui-session-context'
import {
  useTableSync,
  type TableRow as SyncRow,
} from '../../../lib/hooks/use-table-sync'
import { nodeToTableColumnDef } from '../../../lib/utils/build-column-defs'
import { TableCellEditor } from './table-cell-editor'

const MODE_BINDING = 'SposobZapolneniya'
const CYCLIC_CODE = 'PoTsiklamProizvolnoyDliny'
// 2024-01-01 — понедельник: эталонная неделя для подписей Пн…Вс (как в calendar-node)
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru })
)
const MIN_CYCLE = 1
const MAX_CYCLE = 366

export const KalendariTemplateTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const modeValue = useBindingValue(MODE_BINDING)
  // Компоненту нужен «сырой» code режима (например, 'PoTsiklamProizvolnoyDliny'),
  // а не resolveEnumValue (тот отдаёт option.value) — читаем из объекта/строки напрямую.
  const modeCode =
    typeof modeValue === 'string'
      ? modeValue
      : ((modeValue as { code?: string } | undefined)?.code ?? '')
  const cyclic = modeCode === CYCLIC_CODE

  const checkboxCol = (node.children ?? []).find(
    (c) => c.type === 'TABLE_COLUMN' && c.binding === 'DenVklyuchenVGrafik'
  )
  const col = checkboxCol ? nodeToTableColumnDef(checkboxCol) : undefined
  const columns = col ? [col] : []

  const sync = useTableSync(node, columns)

  const rowLabel = (index: number): string =>
    cyclic
      ? t('sdui.kalendari.dayN', { n: index + 1 })
      : (WEEKDAY_LABELS[index] ?? String(index + 1))

  const handleCycleLength = (raw: string) => {
    const n = Math.max(
      MIN_CYCLE,
      Math.min(MAX_CYCLE, Math.floor(Number(raw) || 0))
    )
    if (!Number.isFinite(n) || n < MIN_CYCLE) return
    const current = sync.rows
    const next: SyncRow[] = Array.from({ length: n }, (_, i) =>
      i < current.length
        ? current[i]
        : { rowId: `tmp-${crypto.randomUUID()}`, DenVklyuchenVGrafik: false }
    )
    sync.replaceRows(next)
  }

  if (!col) return null

  return (
    <div className="flex flex-col gap-2">
      {cyclic && (
        <TextField
          label={t('sdui.kalendari.cycleLength')}
          value={String(sync.rows.length)}
          type="number"
          size="small"
          onChange={(e) => {
            handleCycleLength(e.target.value)
          }}
          slotProps={{ htmlInput: { min: MIN_CYCLE, max: MAX_CYCLE } }}
          sx={{ maxWidth: 160 }}
        />
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 160 }}>
                {t('sdui.kalendari.dayColumn')}
              </TableCell>
              <TableCell>
                {col.label || t('sdui.kalendari.workingDay')}
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sync.rows.map((row, index) => (
              <TableRow key={row.rowId}>
                <TableCell>{rowLabel(index)}</TableCell>
                <TableCell>
                  <TableCellEditor
                    cellWidget={col.cellWidget}
                    dataType={col.dataType}
                    value={row[col.binding]}
                    props={col.props}
                    onChange={(val) => {
                      sync.updateCell(row.rowId, col.binding, val)
                    }}
                    onCommit={() => {
                      sync.commitCell()
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
