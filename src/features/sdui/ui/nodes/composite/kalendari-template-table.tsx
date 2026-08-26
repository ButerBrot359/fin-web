import { type FC, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format, isValid, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
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
import {
  CYCLIC_CODE,
  findKalendariNodeByBinding,
  resizeTemplateRows,
} from './kalendari-cycle-length-field'

const MODE_BINDING = 'SposobZapolneniya'
const SCHEDULE_BINDING = 'RaspisanieRaboty'
const HOLIDAYS_BINDING = 'UchityvatPrazdniki'
const REFERENCE_DATE_BINDING = 'DataOtscheta'
/** NomerDnya предпраздничного дня — вне обычных строк шаблона (spec v4). */
const PRE_HOLIDAY_DAY = 0
const WEEK_LENGTH = 7
// 2024-01-01 — понедельник: эталонная неделя для полных подписей
// Понедельник…Воскресенье (spec v4: weekly-режим — полные названия)
const WEEKDAY_LABELS = Array.from({ length: 7 }, (_, i) => {
  const name = format(new Date(2024, 0, 1 + i), 'EEEE', { locale: ru })
  return name.charAt(0).toUpperCase() + name.slice(1)
})
// Вьюпорт ~7 строк (spec v4 §Template): скролл-контейнер, не виртуальное
// усечение — все строки остаются в активном состоянии таблицы
const TEMPLATE_VIEWPORT_MAX_HEIGHT = 310

const NO_COLUMNS: never[] = []

// Заглушка для безусловного вызова useTableSync, когда узла RaspisanieRaboty
// в дереве нет: без binding хук не регистрирует flush и ничего не шлёт.
// Модульная константа — стабильная ссылка между рендерами.
const MISSING_SCHEDULE_NODE: ViewNode = {
  id: 'kalendari-schedule-missing',
  type: 'TABLE',
}

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

  // Праздники управляют доступностью предпраздничного расписания (spec v4)
  const holidaysValue = useBindingValue(HOLIDAYS_BINDING)
  const holidaysOn = holidaysValue === true

  // Дата отсчёта — для колонки дат циклического шаблона; битая/пустая → пусто
  const referenceRaw = useBindingValue(REFERENCE_DATE_BINDING)
  const referenceDate =
    typeof referenceRaw === 'string' && referenceRaw
      ? parseISO(referenceRaw)
      : null
  const referenceValid = referenceDate !== null && isValid(referenceDate)

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
  const scheduleNode = tree
    ? findKalendariNodeByBinding(tree, SCHEDULE_BINDING)
    : null
  const scheduleSync = useTableSync(
    scheduleNode ?? MISSING_SCHEDULE_NODE,
    NO_COLUMNS
  )
  const scheduleRows = scheduleSync.rows as ScheduleRow[]
  const [editDay, setEditDay] = useState<number | null>(null)

  // Бэк при смене SposobZapolneniya строки НЕ пересобирает (коммент Talgat в
  // SCRUM-278 от 18.08): переход на «По неделям» — фронт формирует ровно 7 строк
  // и шлёт полный массив EVENT'ом; переход на циклы строки не трогает (длина
  // цикла = текущее количество). Реагируем только на реальную смену режима.
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
    syncRef.current.replaceRows(resizeTemplateRows(rows, WEEK_LENGTH))
  }, [modeCode])

  const rowLabel = (index: number): string =>
    cyclic
      ? t('sdui.kalendari.dayN', { n: index + 1 })
      : (WEEKDAY_LABELS[index] ?? String(index + 1))

  // Дата строки циклического шаблона: дата отсчёта + index календарных дней,
  // формат d.MM; без валидной даты отсчёта ячейка пустая (spec v4)
  const cyclicDateLabel = (index: number): string =>
    referenceValid ? format(addDays(referenceDate, index), 'd.MM') : ''

  // Ячейка «Рабочее время» дня day (NomerDnya): нет валидных интервалов →
  // текст-действие «Заполнить расписание», есть → кликабельное саммари.
  const workTimeCell = (day: number, disabled = false) => {
    const summary = summarizeDay(scheduleRows, day)
    const open = () => {
      setEditDay(day)
    }
    if (!summary) {
      return (
        <Button variant="text" size="small" disabled={disabled} onClick={open}>
          {t('sdui.kalendari.fillSchedule')}
        </Button>
      )
    }
    return (
      <Button variant="text" size="small" disabled={disabled} onClick={open}>
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
      <Typography variant="body2" fontWeight={600}>
        {t('sdui.kalendari.templateTitle')}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.35 }}
      >
        {t('sdui.kalendari.templateHint')}
      </Typography>
      <TableContainer
        component={Paper}
        sx={{ maxHeight: TEMPLATE_VIEWPORT_MAX_HEIGHT, overflowY: 'auto' }}
      >
        {/* Технической шапки нет (spec v4): состав ячеек читается по 1С-образцу */}
        <Table size="small">
          <TableBody>
            {sync.rows.map((row, index) => (
              <TableRow key={row.rowId}>
                {cyclic ? (
                  <>
                    <TableCell sx={{ width: 56 }}>{index + 1}</TableCell>
                    <TableCell sx={{ width: 72 }}>
                      {cyclicDateLabel(index)}
                    </TableCell>
                  </>
                ) : (
                  <TableCell sx={{ width: 160 }}>{rowLabel(index)}</TableCell>
                )}
                <TableCell sx={{ width: 64 }}>
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
      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.35 }}
      >
        {t('sdui.kalendari.templateIntro')}
      </Typography>
      {scheduleNode && (
        <div className="flex items-center gap-1">
          <Typography
            variant="body2"
            sx={{ color: holidaysOn ? undefined : 'text.disabled' }}
          >
            {t('sdui.kalendari.preHolidaySchedule')}
          </Typography>
          {/* Действие дня 0 доступно только при включённых праздниках (spec v4):
              со снятым чекбоксом редактор предпраздничного дня не открывается */}
          {workTimeCell(PRE_HOLIDAY_DAY, !holidaysOn)}
        </div>
      )}
      {editDay != null && (
        <KalendariScheduleEditor
          day={editDay}
          dayLabel={
            editDay === PRE_HOLIDAY_DAY
              ? t('sdui.kalendari.preHolidayDay')
              : rowLabel(editDay - 1)
          }
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
