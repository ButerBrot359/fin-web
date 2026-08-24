import { describe, expect, it } from 'vitest'

import {
  addManualWorkKind,
  datesInInterval,
  replaceWorkKindCell,
  toggleCollapsedEmployee,
} from './tabel-matrix-table'
import {
  TABEL_MATRIX_WIRE_VERSION,
  type TabelMatrixEmployee,
  type TabelMatrixPayload,
} from './tabel-matrix-contract'

describe('TabelMatrixTable helpers', () => {
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
        { kindNodeId: 'work-kind:7:1', workTimeKindRef: 1, protected: false, cells: {}, total: '0' },
        { kindNodeId: 'work-kind:7:2', workTimeKindRef: 2, protected: true, cells: {}, total: '0' },
      ],
    }

    const updated = replaceWorkKindCell(employee, 'work-kind:7:1', '2026-02-02', '8')

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

    expect(updated.workKinds).toEqual([{
      kindNodeId: 'work-kind:7:12',
      workTimeKindRef: 12,
      workTimeKindPresentation: 'Night work',
      protected: false,
      cells: {},
      total: '0',
    }])
    expect(addManualWorkKind(updated, 12, 'Night work')).toBe(updated)
  })

  it('toggles a semantic employee subtree without changing business rows', () => {
    const collapsed = toggleCollapsedEmployee(new Set(), 'employee:7')

    expect(collapsed).toEqual(new Set(['employee:7']))
    expect(toggleCollapsedEmployee(collapsed, 'employee:7')).toEqual(new Set())
  })
})
