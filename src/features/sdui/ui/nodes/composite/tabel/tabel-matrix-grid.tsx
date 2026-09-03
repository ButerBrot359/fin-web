import { Fragment, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import type {
  TabelEmployee,
  TabelManualWorkKind,
  TabelWorkKind,
} from './tabel-matrix-contract'
import type { DayHeader } from './tabel-matrix-logic'
import { TabelEmployeeRow, TabelKindRow } from './tabel-matrix-rows'

interface TabelMatrixGridProps {
  days: DayHeader[]
  employees: TabelEmployee[]
  collapsed: Set<string>
  activeId: string | null
  busy: boolean
  draftKindsFor: (employeeNodeId: string) => TabelManualWorkKind[]
  onToggle: (employeeNodeId: string) => void
  onSelect: (employee: TabelEmployee) => void
  onDeleteEmployee: (employee: TabelEmployee) => void
  onDeleteKind: (
    employee: TabelEmployee,
    kind: TabelWorkKind,
    draft: boolean
  ) => void
  onCommitCell: (
    employeeNodeId: string,
    workTimeKindRef: number
  ) => (date: string, raw: string) => boolean | Promise<boolean>
}

const draftToKind = (draft: TabelManualWorkKind): TabelWorkKind => ({
  kindNodeId: `draft-${String(draft.workTimeKindRef)}`,
  workTimeKindRef: draft.workTimeKindRef,
  workTimeKindPresentation: draft.presentation,
  protected: false,
  cells: {},
  total: '',
})

/** Сетка матрицы: заголовок дней месяца + дерево сотрудник → виды времени. */
export const TabelMatrixGrid: FC<TabelMatrixGridProps> = ({
  days,
  employees,
  collapsed,
  activeId,
  busy,
  draftKindsFor,
  onToggle,
  onSelect,
  onDeleteEmployee,
  onDeleteKind,
  onCommitCell,
}) => {
  const { t } = useTranslation()

  return (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 3,
                backgroundColor: 'background.paper',
                width: 260,
                minWidth: 260,
                maxWidth: 260,
              }}
            >
              {t('sdui.tabel.employeeColumn')}
            </TableCell>
            {/* «Итого» — вторая колонка, в одной sticky-зоне с колонкой
                сотрудника (спека от 01.09 §1): при горизонтальном скролле
                итог не уезжает раньше дней. */}
            <TableCell
              sx={{
                position: 'sticky',
                left: 260,
                zIndex: 3,
                backgroundColor: 'background.paper',
                textAlign: 'center',
                minWidth: 90,
                borderRight: '1px solid',
                borderRightColor: 'divider',
              }}
            >
              {t('sdui.tabel.totalColumn')}
            </TableCell>
            {days.map((d) => (
              <TableCell
                key={d.iso}
                sx={{
                  textAlign: 'center',
                  p: '4px 2px',
                  minWidth: 38,
                  // Сб/Вс выделены красным (spec v1 §5); праздники — server-owned,
                  // из браузерного календаря дополнительных правил не выводим
                  color: d.weekend ? 'error.main' : undefined,
                }}
              >
                <div style={{ lineHeight: 1.1 }}>
                  <Typography component="div" variant="body2">
                    {d.dayNum}
                  </Typography>
                  <Typography variant="caption" sx={{ opacity: 0.7 }}>
                    {d.weekday}
                  </Typography>
                </div>
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {employees.map((employee) => {
            const expanded = !collapsed.has(employee.employeeNodeId)
            const rows: { kind: TabelWorkKind; draft: boolean }[] = [
              ...employee.workKinds.map((kind) => ({ kind, draft: false })),
              ...draftKindsFor(employee.employeeNodeId).map((d) => ({
                kind: draftToKind(d),
                draft: true,
              })),
            ]
            return (
              <Fragment key={employee.employeeNodeId}>
                <TabelEmployeeRow
                  employee={employee}
                  days={days}
                  expanded={expanded}
                  active={activeId === employee.employeeNodeId}
                  disabled={busy}
                  onToggle={() => {
                    onToggle(employee.employeeNodeId)
                  }}
                  onSelect={() => {
                    onSelect(employee)
                  }}
                  onDelete={() => {
                    onDeleteEmployee(employee)
                  }}
                />
                {expanded &&
                  rows.map(({ kind, draft }) => (
                    <TabelKindRow
                      key={kind.kindNodeId}
                      kind={kind}
                      draft={draft}
                      days={days}
                      disabled={busy}
                      onCommitCell={onCommitCell(
                        employee.employeeNodeId,
                        kind.workTimeKindRef
                      )}
                      onDelete={() => {
                        onDeleteKind(employee, kind, draft)
                      }}
                    />
                  ))}
              </Fragment>
            )
          })}
          {employees.length === 0 && (
            <TableRow>
              <TableCell colSpan={days.length + 2}>
                <Typography
                  variant="body2"
                  sx={{ textAlign: 'center', opacity: 0.6, p: 1 }}
                >
                  {t('table.empty')}
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
