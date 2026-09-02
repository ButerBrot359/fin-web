import type { FC } from 'react'
import { useTranslation } from 'react-i18next'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import {
  IconButton,
  TableCell,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'

import type { TabelEmployee, TabelWorkKind } from './tabel-matrix-contract'
import type { DayHeader } from './tabel-matrix-logic'
import { countKindDays, formatHours } from './tabel-matrix-logic'
import { TabelMatrixCell } from './tabel-matrix-cell'

const dayCellSx = {
  p: 0,
  textAlign: 'center' as const,
  borderLeft: '1px solid',
  borderLeftColor: 'divider',
  minWidth: 38,
}
const weekendSx = { ...dayCellSx, backgroundColor: 'rgba(211, 47, 47, 0.06)' }

// Ширина фиксирована: «Итого» стоит второй sticky-колонкой на left: 260 —
// плавающая ширина имени сдвинула бы её offset (спека от 01.09 §1).
const nameCellSx = {
  position: 'sticky' as const,
  left: 0,
  zIndex: 1,
  backgroundColor: 'background.paper',
  width: 260,
  minWidth: 260,
  maxWidth: 260,
}

const totalCellSx = {
  position: 'sticky' as const,
  left: 260,
  zIndex: 1,
  backgroundColor: 'background.paper',
  textAlign: 'center' as const,
  minWidth: 90,
  borderRight: '1px solid',
  borderRightColor: 'divider',
}

interface EmployeeRowProps {
  employee: TabelEmployee
  days: DayHeader[]
  expanded: boolean
  active: boolean
  disabled: boolean
  onToggle: () => void
  onSelect: () => void
  onDelete: () => void
}

/** Агрегатная строка сотрудника: read-only totals, выбор активного, удаление. */
export const TabelEmployeeRow: FC<EmployeeRowProps> = ({
  employee,
  days,
  expanded,
  active,
  disabled,
  onToggle,
  onSelect,
  onDelete,
}) => {
  const { t } = useTranslation()
  const name = employee.employeePresentation ?? String(employee.employeeRef)
  return (
    <TableRow
      hover
      selected={active}
      onClick={onSelect}
      sx={{ cursor: 'pointer', '& td': { fontWeight: 600 } }}
    >
      <TableCell sx={nameCellSx}>
        <div className="flex items-center gap-1">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            aria-label={t(
              expanded ? 'sdui.tabel.collapse' : 'sdui.tabel.expand'
            )}
          >
            {expanded ? (
              <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
            ) : (
              <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            {name}
          </Typography>
          <Tooltip title={t('sdui.tabel.deleteEmployee')}>
            <span>
              <IconButton
                size="small"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
                aria-label={t('sdui.tabel.deleteEmployee')}
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </TableCell>
      <TableCell sx={totalCellSx}>{formatHours(employee.total)}</TableCell>
      {days.map((d) => (
        <TableCell key={d.iso} sx={d.weekend ? weekendSx : dayCellSx}>
          <Typography component="span" sx={{ fontSize: 13 }}>
            {formatHours(employee.dayTotals[d.iso])}
          </Typography>
        </TableCell>
      ))}
    </TableRow>
  )
}

interface KindRowProps {
  kind: TabelWorkKind
  /** Черновой вид: добавлен локально, ещё не сохранён REPLACE_EMPLOYEE. */
  draft?: boolean
  days: DayHeader[]
  disabled: boolean
  onCommitCell: (date: string, raw: string) => boolean | Promise<boolean>
  onDelete: () => void
}

/** Дочерняя строка вида времени: редактируемые ячейки, protected — read-only. */
export const TabelKindRow: FC<KindRowProps> = ({
  kind,
  draft = false,
  days,
  disabled,
  onCommitCell,
  onDelete,
}) => {
  const { t } = useTranslation()
  const name = kind.workTimeKindPresentation ?? String(kind.workTimeKindRef)
  const daysCount = countKindDays(kind.cells)
  return (
    <TableRow sx={draft ? { '& td': { fontStyle: 'italic' } } : undefined}>
      <TableCell sx={nameCellSx}>
        <div className="flex items-center gap-1" style={{ paddingLeft: 32 }}>
          <Typography variant="body2" sx={{ flex: 1 }} noWrap>
            {name}
          </Typography>
          {kind.protected ? (
            <Tooltip title={t('sdui.tabel.protectedKind')}>
              <LockOutlinedIcon sx={{ fontSize: 14, opacity: 0.6 }} />
            </Tooltip>
          ) : (
            <Tooltip title={t('sdui.tabel.deleteWorkKind')}>
              <span>
                <IconButton
                  size="small"
                  disabled={disabled}
                  onClick={onDelete}
                  aria-label={t('sdui.tabel.deleteWorkKind')}
                >
                  <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </div>
      </TableCell>
      <TableCell sx={totalCellSx}>
        {daysCount > 0 && (
          <Typography variant="caption" noWrap>
            {t('sdui.tabel.kindSummary', {
              days: daysCount,
              hours: formatHours(kind.total),
            })}
          </Typography>
        )}
      </TableCell>
      {days.map((d) => (
        <TableCell key={d.iso} sx={d.weekend ? weekendSx : dayCellSx}>
          <TabelMatrixCell
            value={kind.cells[d.iso]}
            readOnly={kind.protected}
            weekend={d.weekend}
            onCommit={(raw) => onCommitCell(d.iso, raw)}
          />
        </TableCell>
      ))}
    </TableRow>
  )
}
