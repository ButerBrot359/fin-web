import { describe, expect, it } from 'vitest'

import {
  addManualWorkKind,
  collapseAllEmployees,
  datesInInterval,
  formatTabelHours,
  formatTabelDayHeader,
  formatTabelWorkKindTotal,
  filterTabelMatrixEmployees,
  replaceWorkKindCell,
  TABEL_MATRIX_LABELS,
  tabelEmployeePickerConfig,
  tabelManualWorkKindPickerConfig,
  tabelWorkKindCode,
  isTabelWeekend,
  toggleCollapsedEmployee,
} from './tabel-matrix-table'
import {
  TABEL_MATRIX_WIRE_VERSION,
  type TabelMatrixEmployee,
  type TabelMatrixPayload,
} from './tabel-matrix-contract'
import type { ViewNode } from '../../../types/view'

describe('TabelMatrixTable helpers', () => {
  it('keeps the visible matrix controls as decoded Russian labels', () => {
    expect(TABEL_MATRIX_LABELS).toEqual({
      addEmployee: 'Добавить сотрудника',
      selectEmployees: 'Подбор сотрудников',
      addWorkKind: 'Добавить вид времени',
      delete: 'Удалить',
      expandTree: 'Развернуть дерево',
      collapseTree: 'Свернуть дерево',
    })
  })

  it('renders attendance values and totals in the observed compact 1C form', () => {
    expect(formatTabelHours('8.0000')).toBe('8')
    expect(tabelWorkKindCode('Явка')).toBe('Я')
    expect(
      formatTabelWorkKindTotal({
        kindNodeId: 'work-kind:7:1',
        workTimeKindRef: 1,
        workTimeKindPresentation: 'Явка',
        protected: false,
        cells: { '2026-08-01': '8.0000', '2026-08-02': '8' },
        total: '16.0000',
      })
    ).toBe('Я 2 д. 16 ч.')
  })

  it('renders 1C weekday headers and marks weekend columns', () => {
    expect(formatTabelDayHeader('2026-08-12')).toBe('12 Ср')
    expect(formatTabelDayHeader('2026-08-15')).toBe('15 Сб')
    expect(isTabelWeekend('2026-08-15')).toBe(true)
    expect(isTabelWeekend('2026-08-12')).toBe(false)
  })

  it('uses interval dates and replaces only the addressed semantic work-kind cell', () => {
    const payload: TabelMatrixPayload = {
      wireVersion: TABEL_MATRIX_WIRE_VERSION,
      generation: 5,
      interval: { start: '2026-02-01', end: '2026-02-02' },
      employees: [],
      manualWorkKinds: [],
    }
    const employee: TabelMatrixEmployee = {
      employeeNodeId: 'employee:7',
      employeeRef: 7,
      dayTotals: {},
      total: '0',
      workKinds: [
        {
          kindNodeId: 'work-kind:7:1',
          workTimeKindRef: 1,
          protected: false,
          cells: {},
          total: '0',
        },
        {
          kindNodeId: 'work-kind:7:2',
          workTimeKindRef: 2,
          protected: true,
          cells: {},
          total: '0',
        },
      ],
    }

    const updated = replaceWorkKindCell(
      employee,
      'work-kind:7:1',
      '2026-02-02',
      '8'
    )

    expect(datesInInterval(payload)).toEqual(['2026-02-01', '2026-02-02'])
    expect(updated.workKinds[0].cells).toEqual({ '2026-02-02': '8' })
    expect(updated.workKinds[1]).toBe(employee.workKinds[1])
    expect(employee.workKinds[0].cells).toEqual({})
  })

  it('adds an available manual kind once as an editable local draft row', () => {
    const employee: TabelMatrixEmployee = {
      employeeNodeId: 'employee:7',
      employeeRef: 7,
      dayTotals: {},
      total: '0',
      workKinds: [],
    }

    const updated = addManualWorkKind(employee, 12, 'Night work')

    expect(updated.workKinds).toEqual([
      {
        kindNodeId: 'work-kind:7:12',
        workTimeKindRef: 12,
        workTimeKindPresentation: 'Night work',
        protected: false,
        cells: {},
        total: '0',
      },
    ])
    expect(addManualWorkKind(updated, 12, 'Night work')).toBe(updated)
  })

  it('toggles a semantic employee subtree without changing business rows', () => {
    const collapsed = toggleCollapsedEmployee(new Set(), 'employee:7')

    expect(collapsed).toEqual(new Set(['employee:7']))
    expect(toggleCollapsedEmployee(collapsed, 'employee:7')).toEqual(new Set())
  })

  it('collapses every employee without changing the matrix payload', () => {
    const employees: TabelMatrixEmployee[] = [
      {
        employeeNodeId: 'employee:7',
        employeeRef: 7,
        dayTotals: {},
        total: '0',
        workKinds: [],
      },
      {
        employeeNodeId: 'employee:8',
        employeeRef: 8,
        dayTotals: {},
        total: '0',
        workKinds: [],
      },
    ]

    expect(collapseAllEmployees(employees)).toEqual(
      new Set(['employee:7', 'employee:8'])
    )
    expect(employees).toHaveLength(2)
  })

  it('filters the 1C-style tree locally by employee or work-time-kind presentation', () => {
    const employees: TabelMatrixEmployee[] = [
      {
        employeeNodeId: 'employee:7',
        employeeRef: 7,
        employeePresentation: 'Aruzhan',
        dayTotals: {},
        total: '0',
        workKinds: [
          {
            kindNodeId: 'work-kind:7:1',
            workTimeKindRef: 1,
            workTimeKindPresentation: 'Attendance',
            protected: false,
            cells: {},
            total: '0',
          },
        ],
      },
      {
        employeeNodeId: 'employee:8',
        employeeRef: 8,
        employeePresentation: 'Maksat',
        dayTotals: {},
        total: '0',
        workKinds: [
          {
            kindNodeId: 'work-kind:8:2',
            workTimeKindRef: 2,
            workTimeKindPresentation: 'Night work',
            protected: false,
            cells: {},
            total: '0',
          },
        ],
      },
    ]

    expect(filterTabelMatrixEmployees(employees, 'night')).toEqual([
      employees[1],
    ])
    expect(filterTabelMatrixEmployees(employees, '7')).toEqual([employees[0]])
    expect(filterTabelMatrixEmployees(employees, '   ')).toBe(employees)
  })

  it('reuses the backend-owned employee picker type and scope from the table column', () => {
    const table: ViewNode = {
      id: 'table.uchetRabochegoVremeni',
      type: 'TABLE',
      children: [
        {
          id: 'table.uchetRabochegoVremeni.col.sotrudnik',
          type: 'TABLE_COLUMN',
          props: {
            domain: 'DICTIONARY',
            targetTypeCode: 'Sotrudniki',
            filter: { Organizatsiya: 10, entryIds: '7,8' },
          },
        },
      ],
    }

    expect(tabelEmployeePickerConfig(table)).toEqual({
      domain: 'DICTIONARY',
      targetTypeCode: 'Sotrudniki',
      searchParams: { Organizatsiya: '10', entryIds: '7,8' },
    })
  })

  it('opens the work-time-kind picker with only server-authorised manual ids', () => {
    expect(
      tabelManualWorkKindPickerConfig([
        { workTimeKindRef: 8, presentation: 'Night work' },
        { workTimeKindRef: 3, presentation: 'Attendance' },
        { workTimeKindRef: 8, presentation: 'Night work duplicate' },
        { workTimeKindRef: 0, presentation: 'Invalid' },
      ])
    ).toEqual({
      domain: 'DICTIONARY',
      targetTypeCode: 'KlassifikatorRabochegoVremeni',
      searchParams: { entryIds: '8,3' },
    })
    expect(tabelManualWorkKindPickerConfig([])).toBeNull()
  })
})
