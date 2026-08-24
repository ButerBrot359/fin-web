import { useCallback, useMemo, useState, type FC } from 'react'
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
  IconButton,
  Button,
} from '@mui/material'

import type { NodeProps, ViewNode } from '../../../types/view'
import { useSduiDispatch } from '../../../lib/dispatch'
import { useBindingValue } from '../../../lib/sdui-session-context'
import { openReferencePicker } from '../../../lib/reference-picker-gateway'
import {
  isTabelMatrixPayload,
  type TabelMatrixEmployee,
  type TabelMatrixAddEmployeesCommand,
  type TabelMatrixDeleteEmployeeCommand,
  type TabelMatrixPayload,
} from './tabel-matrix-contract'

/** Kept outside the generic table sync: raw packed rows are never browser identity. */
export const TABEL_MATRIX_EVENT_NODE_ID = 'table.uchetRabochegoVremeni.matrix'
export const TABEL_MATRIX_LABELS = {
  addEmployee: 'Добавить сотрудника',
  selectEmployees: 'Подбор сотрудников',
  addWorkKind: 'Добавить вид времени',
  delete: 'Удалить',
  expandTree: 'Развернуть дерево',
  collapseTree: 'Свернуть дерево',
} as const

export interface TabelEmployeePickerConfig {
  domain: string
  targetTypeCode: string
  searchParams?: Record<string, string>
}

interface GenerationScopedState<T> {
  generation: number | null
  value: T
}

function operationId(): string {
  return globalThis.crypto.randomUUID()
}

/** Reuses the existing Sotrudnik column's server-supplied picker contract. */
export function tabelEmployeePickerConfig(
  node: ViewNode
): TabelEmployeePickerConfig | null {
  const employeeColumn = node.children?.find(
    (child) => child.id === `${node.id}.col.sotrudnik`
  )
  const domain = employeeColumn?.props?.domain
  const targetTypeCode = employeeColumn?.props?.targetTypeCode
  if (
    typeof domain !== 'string' ||
    !domain ||
    typeof targetTypeCode !== 'string' ||
    !targetTypeCode
  ) {
    return null
  }
  const filter = employeeColumn.props?.filter
  const searchParams =
    filter && typeof filter === 'object' && !Array.isArray(filter)
      ? Object.fromEntries(
          Object.entries(filter).map(([key, value]) => [key, String(value)])
        )
      : undefined
  return { domain, targetTypeCode, searchParams }
}

/**
 * 1C opens `КлассификаторРабочегоВремени.ФормаВыбора` with exactly the
 * server-authorised manual kinds. `entryIds` is enforced by the existing
 * dictionary endpoint, while the backend repeats the membership check when
 * the local draft is later committed with a cell edit.
 */
export function tabelManualWorkKindPickerConfig(
  manualWorkKinds: TabelMatrixPayload['manualWorkKinds']
): TabelEmployeePickerConfig | null {
  const entryIds = [
    ...new Set(manualWorkKinds.map((kind) => kind.workTimeKindRef)),
  ]
    .filter((entryId) => Number.isSafeInteger(entryId) && entryId > 0)
    .join(',')
  if (!entryIds) return null
  return {
    domain: 'DICTIONARY',
    targetTypeCode: 'KlassifikatorRabochegoVremeni',
    searchParams: { entryIds },
  }
}

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
  if (
    employee.workKinds.some((kind) => kind.workTimeKindRef === workTimeKindRef)
  )
    return employee
  return {
    ...employee,
    workKinds: [
      ...employee.workKinds,
      {
        kindNodeId: `work-kind:${String(employee.employeeRef)}:${String(workTimeKindRef)}`,
        workTimeKindRef,
        workTimeKindPresentation: presentation,
        protected: false,
        cells: {},
        total: '0',
      },
    ],
  }
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

export function collapseAllEmployees(
  employees: readonly TabelMatrixEmployee[]
): Set<string> {
  return new Set(employees.map((employee) => employee.employeeNodeId))
}

/** Mirrors the 1C tree search control without changing the server-owned matrix payload. */
export function filterTabelMatrixEmployees(
  employees: readonly TabelMatrixEmployee[],
  query: string
): readonly TabelMatrixEmployee[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return employees
  return employees.filter((employee) =>
    [
      employee.employeePresentation,
      String(employee.employeeRef),
      ...employee.workKinds.map(
        (kind) => kind.workTimeKindPresentation ?? String(kind.workTimeKindRef)
      ),
    ].some((value) => (value ?? '').toLocaleLowerCase().includes(normalized))
  )
}

export const TabelMatrixTable: FC<NodeProps> = ({ node }) => {
  const value = useBindingValue(node.binding)
  const dispatch = useSduiDispatch()
  const payload = isTabelMatrixPayload(value) ? value : null
  const [draftState, setDraftState] = useState<
    GenerationScopedState<Record<string, TabelMatrixEmployee>>
  >({ generation: null, value: {} })
  const [collapsedState, setCollapsedState] = useState<
    GenerationScopedState<Set<string>>
  >({ generation: null, value: new Set() })
  const [selectedEmployeeNodeId, setSelectedEmployeeNodeId] = useState<
    string | null
  >(null)
  const [search, setSearch] = useState('')
  const dates = useMemo(
    () => (payload ? datesInInterval(payload) : []),
    [payload]
  )
  const visibleEmployees = useMemo(
    () =>
      payload ? filterTabelMatrixEmployees(payload.employees, search) : [],
    [payload, search]
  )
  const employeePicker = useMemo(() => tabelEmployeePickerConfig(node), [node])
  const workKindPicker = useMemo(
    () => tabelManualWorkKindPickerConfig(payload?.manualWorkKinds ?? []),
    [payload?.manualWorkKinds]
  )

  // A server patch is authoritative: a new generation ignores drafts and expands the tree.
  const drafts =
    draftState.generation === payload?.generation ? draftState.value : {}
  const collapsedEmployeeNodeIds =
    collapsedState.generation === payload?.generation
      ? collapsedState.value
      : new Set<string>()
  const activeEmployeeNodeId =
    selectedEmployeeNodeId &&
    payload?.employees.some(
      (employee) => employee.employeeNodeId === selectedEmployeeNodeId
    )
      ? selectedEmployeeNodeId
      : null

  const commit = useCallback(
    (
      employee: TabelMatrixEmployee,
      kindNodeId: string,
      date: string,
      value: string
    ) => {
      if (!payload) return
      const updatedEmployee = replaceWorkKindCell(
        employee,
        kindNodeId,
        date,
        value
      )
      setDraftState((current) => ({
        generation: payload.generation,
        value: {
          ...(current.generation === payload.generation ? current.value : {}),
          [employee.employeeNodeId]: updatedEmployee,
        },
      }))
      void dispatch({
        type: 'EVENT',
        sourceNodeId: TABEL_MATRIX_EVENT_NODE_ID,
        trigger: 'change',
        value: {
          type: 'REPLACE_EMPLOYEE',
          operationId: operationId(),
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
          operationId: operationId(),
          baseGeneration: payload.generation,
          employeeNodeId: employee.employeeNodeId,
          employeeRef: employee.employeeRef,
          workTimeKindRef,
        },
      })
    },
    [dispatch, payload]
  )

  const addEmployee = useCallback(() => {
    if (!payload || !employeePicker) return
    openReferencePicker({
      mode: 'list',
      domain: employeePicker.domain,
      typeCode: employeePicker.targetTypeCode,
      searchParams: employeePicker.searchParams,
      onSelect: (option) => {
        if (!option) return
        const employeeRef = Number(option.id)
        if (!Number.isSafeInteger(employeeRef) || employeeRef <= 0) return
        void dispatch({
          type: 'EVENT',
          sourceNodeId: TABEL_MATRIX_EVENT_NODE_ID,
          trigger: 'change',
          value: {
            type: 'ADD_EMPLOYEE',
            operationId: operationId(),
            baseGeneration: payload.generation,
            employeeRef,
          },
        })
      },
    })
  }, [dispatch, employeePicker, payload])

  const selectEmployees = useCallback(() => {
    if (!payload || !employeePicker) return
    openReferencePicker({
      mode: 'list',
      domain: employeePicker.domain,
      typeCode: employeePicker.targetTypeCode,
      searchParams: employeePicker.searchParams,
      multiple: true,
      onSelect: () => {
        /* Selection is returned through onSelectMany. */
      },
      onSelectMany: (options) => {
        const employeeRefs = [
          ...new Set(options.map((option) => Number(option.id))),
        ].filter(
          (employeeRef) => Number.isSafeInteger(employeeRef) && employeeRef > 0
        )
        if (employeeRefs.length === 0) return
        const command: TabelMatrixAddEmployeesCommand = {
          type: 'ADD_EMPLOYEES',
          operationId: operationId(),
          baseGeneration: payload.generation,
          employeeRefs,
        }
        void dispatch({
          type: 'EVENT',
          sourceNodeId: TABEL_MATRIX_EVENT_NODE_ID,
          trigger: 'change',
          value: command,
        })
      },
    })
  }, [dispatch, employeePicker, payload])

  const selectEmployee = useCallback(
    (employeeRef: number) => {
      if (!payload) return
      setSelectedEmployeeNodeId(`employee:${String(employeeRef)}`)
      void dispatch({
        type: 'EVENT',
        sourceNodeId: TABEL_MATRIX_EVENT_NODE_ID,
        trigger: 'change',
        value: {
          type: 'SELECT_EMPLOYEE',
          baseGeneration: payload.generation,
          employeeRef,
        },
      })
    },
    [dispatch, payload]
  )

  const addWorkKind = useCallback(() => {
    if (!payload || !workKindPicker || !activeEmployeeNodeId) return
    const serverEmployee = payload.employees.find(
      (employee) => employee.employeeNodeId === activeEmployeeNodeId
    )
    if (!serverEmployee) return
    openReferencePicker({
      mode: 'list',
      domain: workKindPicker.domain,
      typeCode: workKindPicker.targetTypeCode,
      searchParams: workKindPicker.searchParams,
      onSelect: (option) => {
        if (!option) return
        const workTimeKindRef = Number(option.id)
        const choice = payload.manualWorkKinds.find(
          (kind) => kind.workTimeKindRef === workTimeKindRef
        )
        if (!choice) return
        setDraftState((current) => {
          const draftsForGeneration =
            current.generation === payload.generation ? current.value : {}
          const employee =
            draftsForGeneration[serverEmployee.employeeNodeId] ?? serverEmployee
          return {
            generation: payload.generation,
            value: {
              ...draftsForGeneration,
              [employee.employeeNodeId]: addManualWorkKind(
                employee,
                choice.workTimeKindRef,
                choice.presentation
              ),
            },
          }
        })
      },
    })
  }, [activeEmployeeNodeId, payload, workKindPicker])

  const deleteEmployee = useCallback(() => {
    if (!payload || !activeEmployeeNodeId) return
    const employee = payload.employees.find(
      (candidate) => candidate.employeeNodeId === activeEmployeeNodeId
    )
    if (!employee) return
    const command: TabelMatrixDeleteEmployeeCommand = {
      type: 'DELETE_EMPLOYEE',
      operationId: operationId(),
      baseGeneration: payload.generation,
      employeeNodeId: employee.employeeNodeId,
      employeeRef: employee.employeeRef,
    }
    void dispatch({
      type: 'EVENT',
      sourceNodeId: TABEL_MATRIX_EVENT_NODE_ID,
      trigger: 'change',
      value: command,
    })
  }, [activeEmployeeNodeId, dispatch, payload])

  if (!payload) {
    return (
      <Typography color="error">
        Неподдерживаемый ответ матрицы Табеля.
      </Typography>
    )
  }

  return (
    <Box>
      <Button
        size="small"
        variant="outlined"
        onClick={addEmployee}
        disabled={!employeePicker}
        sx={{ mb: 1 }}
      >
        {TABEL_MATRIX_LABELS.addEmployee}
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={selectEmployees}
        disabled={!employeePicker}
        sx={{ mb: 1, ml: 1 }}
      >
        {TABEL_MATRIX_LABELS.selectEmployees}
      </Button>
      <Button
        size="small"
        variant="outlined"
        onClick={addWorkKind}
        disabled={!workKindPicker || !activeEmployeeNodeId}
        sx={{ mb: 1, ml: 1 }}
      >
        {TABEL_MATRIX_LABELS.addWorkKind}
      </Button>
      <Button
        size="small"
        variant="text"
        color="error"
        onClick={deleteEmployee}
        disabled={!activeEmployeeNodeId}
        sx={{ mb: 1, ml: 1 }}
      >
        {TABEL_MATRIX_LABELS.delete}
      </Button>
      <Button
        size="small"
        variant="text"
        onClick={() => {
          setCollapsedState({
            generation: payload.generation,
            value: new Set(),
          })
        }}
        sx={{ mb: 1, ml: 1 }}
      >
        {TABEL_MATRIX_LABELS.expandTree}
      </Button>
      <Button
        size="small"
        variant="text"
        onClick={() => {
          setCollapsedState({
            generation: payload.generation,
            value: collapseAllEmployees(payload.employees),
          })
        }}
        sx={{ mb: 1, ml: 1 }}
      >
        {TABEL_MATRIX_LABELS.collapseTree}
      </Button>
      <TextField
        size="small"
        label="Поиск"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value)
        }}
        sx={{ mb: 1, ml: 1, minWidth: 180 }}
        slotProps={{ htmlInput: { 'aria-label': 'Поиск в табеле' } }}
      />
      <TableContainer
        component={Paper}
        variant="outlined"
        data-testid="tabel-matrix"
      >
        <Table size="small" stickyHeader sx={{ minWidth: 960 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 220 }}>
                Сотрудник / вид времени
              </TableCell>
              {dates.map((date) => (
                <TableCell key={date} align="center" sx={{ minWidth: 64 }}>
                  {date.slice(-2)}
                </TableCell>
              ))}
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleEmployees.map((serverEmployee) => {
              const employee =
                drafts[serverEmployee.employeeNodeId] ?? serverEmployee
              return (
                <TabelEmployeeRows
                  key={employee.employeeNodeId}
                  employee={employee}
                  dates={dates}
                  onCommit={commit}
                  onDeleteWorkKind={deleteWorkKind}
                  onSelectEmployee={selectEmployee}
                  expanded={
                    !collapsedEmployeeNodeIds.has(employee.employeeNodeId)
                  }
                  onToggleExpanded={() => {
                    setCollapsedState((current) => ({
                      generation: payload.generation,
                      value: toggleCollapsedEmployee(
                        current.generation === payload.generation
                          ? current.value
                          : new Set(),
                        employee.employeeNodeId
                      ),
                    }))
                  }}
                />
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

const TabelEmployeeRows: FC<{
  employee: TabelMatrixEmployee
  dates: string[]
  onCommit: (
    employee: TabelMatrixEmployee,
    kindNodeId: string,
    date: string,
    value: string
  ) => void
  onDeleteWorkKind: (
    employee: TabelMatrixEmployee,
    workTimeKindRef: number
  ) => void
  onSelectEmployee: (employeeRef: number) => void
  expanded: boolean
  onToggleExpanded: () => void
}> = ({
  employee,
  dates,
  onCommit,
  onDeleteWorkKind,
  onSelectEmployee,
  expanded,
  onToggleExpanded,
}) => (
  <>
    <TableRow
      onClick={() => {
        onSelectEmployee(employee.employeeRef)
      }}
      sx={{
        '& > td': { bgcolor: 'action.hover', fontWeight: 700 },
        cursor: 'pointer',
      }}
    >
      <TableCell>
        <IconButton
          aria-label={
            expanded ? 'Свернуть сотрудника' : 'Развернуть сотрудника'
          }
          size="small"
          onClick={onToggleExpanded}
        >
          {expanded ? (
            <ExpandLessIcon fontSize="small" />
          ) : (
            <ExpandMoreIcon fontSize="small" />
          )}
        </IconButton>
        {employee.employeePresentation ??
          `Сотрудник ${String(employee.employeeRef)}`}
      </TableCell>
      {dates.map((date) => (
        <TableCell key={date} align="center">
          {employee.dayTotals[date] ?? ''}
        </TableCell>
      ))}
      <TableCell align="right">{employee.total}</TableCell>
    </TableRow>
    {expanded &&
      employee.workKinds.map((kind) => (
        <TableRow key={kind.kindNodeId}>
          <TableCell sx={{ pl: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip
                title={
                  kind.protected ? (kind.protectionCode ?? 'Protected') : ''
                }
              >
                <Box component="span">
                  {kind.workTimeKindPresentation ??
                    `Вид ${String(kind.workTimeKindRef)}`}
                </Box>
              </Tooltip>
              <IconButton
                aria-label="Удалить вид времени"
                size="small"
                disabled={kind.protected}
                onClick={() => {
                  onDeleteWorkKind(employee, kind.workTimeKindRef)
                }}
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
                slotProps={{
                  htmlInput: {
                    'aria-label': `${String(employee.employeeRef)}-${String(kind.workTimeKindRef)}-${date}`,
                    inputMode: 'decimal',
                  },
                }}
                onBlur={(event) => {
                  onCommit(employee, kind.kindNodeId, date, event.target.value)
                }}
                sx={{ width: 52 }}
              />
            </TableCell>
          ))}
          <TableCell align="right">{kind.total}</TableCell>
        </TableRow>
      ))}
  </>
)
