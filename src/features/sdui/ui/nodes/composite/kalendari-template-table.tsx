import { type FC, useEffect, useRef, useState } from 'react'
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

  // Локальный буфер поля длины цикла: коммит на blur/Enter, не на каждый keystroke —
  // resize-на-onChange стирал хвост при обычном перепечатывании (backspace → "" →
  // clamp к 1 → replaceRows дропает строки 2..N → набор заново создаёт их unchecked
  // tmp-*, исходный checked-хвост потерян) и слал по EVENT'у на каждый символ.
  const [cycleInput, setCycleInput] = useState<string>(String(sync.rows.length))
  const cycleFocusedRef = useRef(false)

  // Синхронизация буфера с каноном при внешних изменениях (смена режима,
  // REPLACE с бэка) — но не пока пользователь активно печатает, иначе перезапись
  // случилась бы прямо под курсором.
  useEffect(() => {
    if (cycleFocusedRef.current) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- синхронизация с внешним каноном (см. use-table-sync.ts)
    setCycleInput(String(sync.rows.length))
  }, [sync.rows.length])

  const rowLabel = (index: number): string =>
    cyclic
      ? t('sdui.kalendari.dayN', { n: index + 1 })
      : (WEEKDAY_LABELS[index] ?? String(index + 1))

  const commitCycleLength = (raw: string) => {
    const parsed = raw.trim() === '' ? NaN : Math.floor(Number(raw))
    if (!Number.isFinite(parsed)) {
      // Пустое/невалидное значение — откатываем буфер, resize не делаем.
      setCycleInput(String(sync.rows.length))
      return
    }
    const n = Math.max(MIN_CYCLE, Math.min(MAX_CYCLE, parsed))
    if (n !== sync.rows.length) {
      const current = sync.rows
      const next: SyncRow[] = Array.from({ length: n }, (_, i) =>
        i < current.length
          ? current[i]
          : { rowId: `tmp-${crypto.randomUUID()}`, DenVklyuchenVGrafik: false }
      )
      sync.replaceRows(next)
    }
    setCycleInput(String(n))
  }

  if (!col) return null

  return (
    <div className="flex flex-col gap-2">
      {cyclic && (
        <TextField
          label={t('sdui.kalendari.cycleLength')}
          value={cycleInput}
          type="number"
          size="small"
          onChange={(e) => {
            setCycleInput(e.target.value)
          }}
          onFocus={() => {
            cycleFocusedRef.current = true
          }}
          onBlur={(e) => {
            cycleFocusedRef.current = false
            commitCycleLength(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitCycleLength((e.target as HTMLInputElement).value)
            }
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
