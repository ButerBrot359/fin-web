import { useCallback, useEffect, useMemo, useState, type FC } from 'react'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Select,
  MenuItem,
  IconButton,
} from '@mui/material'

import type { NodeProps } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useBindingValue } from '../../../lib/sdui-session-context'
import {
  isTabelMatrixPayload,
  type TabelMatrixEmployee,
  type TabelMatrixPayload,
} from './tabel-matrix-contract'

/** Kept outside the generic table sync: raw packed rows are never browser identity. */
export const TABEL_MATRIX_EVENT_NODE_ID = 'table.uchetRabochegoVremeni.matrix'

export function datesInInterval(payload: TabelMatrixPayload): string[] {
  const dates: string[] = []
  const cursor = new Date(`${payload.interval.start}T00:00:00Z`)
  const end = new Date(`${payload.interval.end}T00:00:00Z`)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

export function replaceWorkKindCell(
  employee: TabelMatrixEmployee,
  kindNodeId: string,
  date: string,
  value: string
): TabelMatrixEmployee {
  return {
    ...employee,
    workKinds: employee.workKinds.map((kind) =>
      kind.kindNodeId === kindNodeId
        ? { ...kind, cells: { ...kind.cells, [date]: value } }
        : kind
    ),
  }
}

export function addManualWorkKind(
  employee: TabelMatrixEmployee,
  workTimeKindRef: number,
  presentation: string
): TabelMatrixEmployee {
  if (employee.workKinds.some((kind) => kind.workTimeKindRef === workTimeKindRef)) return employee
  return { ...employee, workKinds: [...employee.workKinds, {
    kindNodeId: `work-kind:${employee.employeeRef}:${workTimeKindRef}`,
    workTimeKindRef, workTimeKindPresentation: presentation, protected: false, cells: {}, total: '0',
  }] }
}

export function toggleCollapsedEmployee(
  collapsedEmployeeNodeIds: ReadonlySet<string>,
  employeeNodeId: string
): Set<string> {
  const next = new Set(collapsedEmployeeNodeIds)
  if (next.has(employeeNodeId)) next.delete(employeeNodeId)
  else next.add(employeeNodeId)
  return next
}

export const TabelMatrixTable: FC<NodeProps> = ({ node }) => {
  const value = useBindingValue(node.binding)
  const dispatch = useSduiDispatch()
  const payload = isTabelMatrixPayload(value) ? value : null
  const [drafts, setDrafts] = useState<Record<string, TabelMatrixEmployee>>({})
  const [collapsedEmployeeNodeIds, setCollapsedEmployeeNodeIds] = useState<Set<string>>(new Set())
  const dates = useMemo(() => (payload ? datesInInterval(payload) : []), [payload])

  // A server patch is authoritative: keep a local draft only until its generation advances.
  useEffect(() => {
    setDrafts({})
  }, [payload?.generation])

  const commit = useCallback(
    (employee: TabelMatrixEmployee, kindNodeId: string, date: string, value: string) => {
      if (!payload) return
      const updatedEmployee = replaceWorkKindCell(employee, kindNodeId, date, value)
      setDrafts((current) => ({ ...current, [employee.employeeNodeId]: updatedEmployee }))
      void dispatch({
        type: 'EVENT',
        sourceNodeId: TABEL_MATRIX_EVENT_NODE_ID,
        trigger: 'change',
        value: {
          type: 'REPLACE_EMPLOYEE',
          operationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          baseGeneration: payload.generation,
          employeeNodeId: employee.employeeNodeId,
          employee: {
            employeeRef: updatedEmployee.employeeRef,
            workKinds: updatedEmployee.workKinds,
          },
        },
      })
    },
    [dispatch, payload]
  )

  const deleteWorkKind = useCallback(
    (employee: TabelMatrixEmployee, workTimeKindRef: number) => {
      if (!payload) return
      void dispatch({
        type: 'EVENT',
        sourceNodeId: TABEL_MATRIX_EVENT_NODE_ID,
        trigger: 'change',
        value: {
          type: 'DELETE_WORK_KIND',
          operationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
          baseGeneration: payload.generation,
          employeeNodeId: employee.employeeNodeId,
          employeeRef: employee.employeeRef,
          workTimeKindRef,
        },
      })
    },
    [dispatch, payload]
  )

  if (!payload) {
    return <Typography color="error">Неподдерживаемый ответ матрицы Табеля.</Typography>
  }

  return (
    <TableContainer component={Paper} variant="outlined" data-testid="tabel-matrix">
      <Table size="small" stickyHeader sx={{ minWidth: 960 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 220 }}>Сотрудник / вид времени</TableCell>
            {dates.map((date) => (
              <TableCell key={date} align="center" sx={{ minWidth: 64 }}>
                {date.slice(-2)}
              </TableCell>
            ))}
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payload.employees.map((serverEmployee) => {
            const employee = drafts[serverEmployee.employeeNodeId] ?? serverEmployee
            return (
            <TabelEmployeeRows
              key={employee.employeeNodeId}
              employee={employee}
              dates={dates}
              onCommit={commit}
              onDeleteWorkKind={deleteWorkKind}
              expanded={!collapsedEmployeeNodeIds.has(employee.employeeNodeId)}
              onToggleExpanded={() => setCollapsedEmployeeNodeIds((current) =>
                toggleCollapsedEmployee(current, employee.employeeNodeId))}
              manualWorkKinds={payload.manualWorkKinds}
              onAddKind={(workTimeKindRef, presentation) => setDrafts((current) => ({
                ...current,
                [employee.employeeNodeId]: addManualWorkKind(employee, workTimeKindRef, presentation),
              }))}
            />
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

const TabelEmployeeRows: FC<{
  employee: TabelMatrixEmployee
  dates: string[]
  onCommit: (employee: TabelMatrixEmployee, kindNodeId: string, date: string, value: string) => void
  onDeleteWorkKind: (employee: TabelMatrixEmployee, workTimeKindRef: number) => void
  expanded: boolean
  onToggleExpanded: () => void
  manualWorkKinds: TabelMatrixPayload['manualWorkKinds']
  onAddKind: (workTimeKindRef: number, presentation: string) => void
}> = ({ employee, dates, onCommit, onDeleteWorkKind, expanded, onToggleExpanded, manualWorkKinds, onAddKind }) => (
  <>
    <TableRow sx={{ '& > td': { bgcolor: 'action.hover', fontWeight: 700 } }}>
      <TableCell>
        <IconButton
          aria-label={expanded ? 'Свернуть сотрудника' : 'Развернуть сотрудника'}
          size="small"
          onClick={onToggleExpanded}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
        {employee.employeePresentation ?? `Сотрудник ${employee.employeeRef}`}
      </TableCell>
      {dates.map((date) => (
        <TableCell key={date} align="center">{employee.dayTotals[date] ?? ''}</TableCell>
      ))}
      <TableCell align="right">{employee.total}</TableCell>
    </TableRow>
    {expanded && employee.workKinds.map((kind) => (
      <TableRow key={kind.kindNodeId}>
        <TableCell sx={{ pl: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={kind.protected ? (kind.protectionCode ?? 'Protected') : ''}>
              <Box component="span">{kind.workTimeKindPresentation ?? `Вид ${kind.workTimeKindRef}`}</Box>
            </Tooltip>
            <IconButton
              aria-label="Удалить вид времени"
              size="small"
              disabled={kind.protected}
              onClick={() => onDeleteWorkKind(employee, kind.workTimeKindRef)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        </TableCell>
        {dates.map((date) => (
          <TableCell key={date} align="center" sx={{ p: 0.5 }}>
            <TextField
              key={`${kind.kindNodeId}:${date}:${kind.cells[date] ?? ''}`}
              variant="standard"
              defaultValue={kind.cells[date] ?? ''}
              disabled={kind.protected}
              inputProps={{ 'aria-label': `${employee.employeeRef}-${kind.workTimeKindRef}-${date}`, inputMode: 'decimal' }}
              onBlur={(event) => onCommit(employee, kind.kindNodeId, date, event.target.value)}
              sx={{ width: 52 }}
            />
          </TableCell>
        ))}
        <TableCell align="right">{kind.total}</TableCell>
      </TableRow>
    ))}
    {expanded && <TableRow>
      <TableCell sx={{ pl: 4 }}>
        <Select value="" displayEmpty size="small" onChange={(event) => {
          const ref = Number(event.target.value)
          const choice = manualWorkKinds.find((kind) => kind.workTimeKindRef === ref)
          if (choice) onAddKind(choice.workTimeKindRef, choice.presentation)
        }}>
          <MenuItem value="">Добавить вид времени</MenuItem>
          {manualWorkKinds.filter((choice) => !employee.workKinds.some((kind) => kind.workTimeKindRef === choice.workTimeKindRef))
            .map((choice) => <MenuItem key={choice.workTimeKindRef} value={choice.workTimeKindRef}>{choice.presentation}</MenuItem>)}
        </Select>
      </TableCell>
      <TableCell colSpan={dates.length + 1} />
    </TableRow>}
  </>
)
