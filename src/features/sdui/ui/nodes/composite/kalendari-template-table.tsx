import { type FC, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material'

import type { NodeProps, ViewNode } from '../../../types/view'
import {
  useBindingValue,
  useSduiSession,
} from '../../../lib/sdui-session-context'
import {
  useTableSync,
  type TableRow as SyncRow,
} from '../../../lib/hooks/use-table-sync'
import { nodeToTableColumnDef } from '../../../lib/utils/build-column-defs'
import { TableCellEditor } from './table-cell-editor'
import { summarizeDay, type ScheduleRow } from './kalendari-schedule-summary'
import { KalendariScheduleEditor } from './kalendari-schedule-editor'

const MODE_BINDING = 'SposobZapolneniya'
const SCHEDULE_BINDING = 'RaspisanieRaboty'
const CYCLIC_CODE = 'PoTsiklamProizvolnoyDliny'
// 2024-01-01 — понедельник: эталонная неделя для подписей Пн…Вс (как в calendar-node)
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) =>
  format(new Date(2024, 0, 1 + i), 'EEEEEE', { locale: ru })
)
const MIN_CYCLE = 1
const MAX_CYCLE = 366
const WEEK_LENGTH = 7

// Общие позиции сохраняются, недостающие достраиваются unchecked с tmp-* id
// (spec v2 §5: resize replaces the local ordered template array).
const resizeRows = (current: SyncRow[], n: number): SyncRow[] =>
  Array.from({ length: n }, (_, i) =>
    i < current.length
      ? current[i]
      : { rowId: `tmp-${crypto.randomUUID()}`, DenVklyuchenVGrafik: false }
  )

const findNodeByBinding = (
  root: ViewNode,
  binding: string
): ViewNode | null => {
  if (root.binding === binding) return root
  for (const child of root.children ?? []) {
    const found = findNodeByBinding(child, binding)
    if (found) return found
  }
  return null
}

// Заглушка для безусловного вызова useTableSync, когда узла RaspisanieRaboty
// в дереве нет: без binding хук не регистрирует flush и ничего не шлёт.
const MISSING_SCHEDULE_NODE: ViewNode = {
  id: 'kalendari-schedule-missing',
  type: 'TABLE',
}
const NO_COLUMNS: never[] = []

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

  // Рабочее время живёт в независимой таблице RaspisanieRaboty (spec v3):
  // её узел не рендерится отдельно — шаблон находит его в дереве сессии и
  // владеет его синком. Полный снимок массива — контракт таблицы.
  const { tree } = useSduiSession()
  const scheduleNode = tree ? findNodeByBinding(tree, SCHEDULE_BINDING) : null
  const scheduleSync = useTableSync(
    scheduleNode ?? MISSING_SCHEDULE_NODE,
    NO_COLUMNS
  )
  const scheduleRows = scheduleSync.rows as ScheduleRow[]
  const [editDay, setEditDay] = useState<number | null>(null)

  // Бэк при смене SposobZapolneniya строки НЕ пересобирает (коммент Talgat в
  // SCRUM-278 от 18.08): переход на «По неделям» — фронт формирует ровно 7 строк
  // и шлёт полный массив EVENT'ом; переход на циклы строки не трогает (длина
  // цикла = текущее количество). Реагируем только на реальную смену режима:
  // prevMode непустой и отличается — первичная гидратация ('' → значение) не
  // должна слать EVENT, дефолтные 7 строк новой карточки — зона бэка (spec v1).
  const prevModeRef = useRef(modeCode)
  const syncRef = useRef(sync)
  useEffect(() => {
    syncRef.current = sync
  })
  useEffect(() => {
    const prev = prevModeRef.current
    prevModeRef.current = modeCode
    if (!prev || !modeCode || prev === modeCode) return
    if (modeCode === CYCLIC_CODE) return
    const rows = syncRef.current.rows
    if (rows.length === WEEK_LENGTH) return
    syncRef.current.replaceRows(resizeRows(rows, WEEK_LENGTH))
  }, [modeCode])

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
      sync.replaceRows(resizeRows(sync.rows, n))
    }
    setCycleInput(String(n))
  }

  // Ячейка «Рабочее время» дня day (NomerDnya = позиция в шаблоне, 1..N):
  // нет валидных интервалов → «Заполнить расписание», есть → кликабельное
  // саммари «9 ч. (09:00–18:00)». Оба открывают модалку этого дня.
  const workTimeCell = (day: number) => {
    const summary = summarizeDay(scheduleRows, day)
    if (!summary) {
      return (
        <Button
          variant="outlined"
          size="small"
          onClick={() => {
            setEditDay(day)
          }}
        >
          {t('sdui.kalendari.fillSchedule')}
        </Button>
      )
    }
    return (
      <Button
        variant="text"
        size="small"
        onClick={() => {
          setEditDay(day)
        }}
      >
        {t('sdui.kalendari.daySummary', {
          hours: summary.hours,
          intervals: summary.intervals
            .map((i) => `${i.start}–${i.end}`)
            .join(', '),
        })}
      </Button>
    )
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
              {scheduleNode && (
                <TableCell>{t('sdui.kalendari.workTime')}</TableCell>
              )}
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
                {scheduleNode && (
                  <TableCell>{workTimeCell(index + 1)}</TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {editDay != null && (
        <KalendariScheduleEditor
          day={editDay}
          dayLabel={rowLabel(editDay - 1)}
          rows={scheduleRows}
          onApply={(next) => {
            scheduleSync.replaceRows(next as SyncRow[])
            setEditDay(null)
          }}
          onClose={() => {
            setEditDay(null)
          }}
        />
      )}
    </div>
  )
}
