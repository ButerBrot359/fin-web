import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

import type { ViewNode } from '../../../types/view'
import { TabelMatrixTable } from './tabel-matrix-table'
import { TABEL_MATRIX_WIRE_VERSION } from './tabel-matrix-contract'

const dispatch = vi.fn<(action: unknown) => Promise<boolean>>(() =>
  Promise.resolve(true)
)
const state: Record<string, unknown> = {}

vi.mock('../../../lib/dispatch', () => ({
  useSduiDispatch: () => dispatch,
}))

vi.mock('../../../lib/sdui-session-context', () => ({
  useBindingValue: (binding?: string) => (binding ? state[binding] : undefined),
}))

vi.mock('../../../lib/reference-picker-gateway', () => ({
  openReferencePicker: vi.fn(),
}))

const node: ViewNode = {
  id: 'table.uchetRabochegoVremeni',
  type: 'TABLE',
  binding: 'tabel.matrix',
  props: {
    sourceBinding: 'UchetRabochegoVremeni',
    tablePresentation: 'TABEL_MATRIX',
    tableWireVersion: TABEL_MATRIX_WIRE_VERSION,
  },
} as ViewNode

describe('TabelMatrixTable', () => {
  beforeEach(() => {
    dispatch.mockReset()
    dispatch.mockResolvedValue(true)
    state['tabel.matrix'] = {
      wireVersion: TABEL_MATRIX_WIRE_VERSION,
      generation: 8,
      interval: { start: '2026-02-01', end: '2026-02-01' },
      manualWorkKinds: [],
      employees: [
        {
          employeeNodeId: 'employee:7',
          employeeRef: 7,
          employeePresentation: 'Aruzhan',
          dayTotals: { '2026-02-01': '8' },
          total: '8',
          workKinds: [
            {
              kindNodeId: 'work-kind:7:3',
              workTimeKindRef: 3,
              workTimeKindPresentation: 'Attendance',
              protected: false,
              cells: { '2026-02-01': '8' },
              total: '8',
            },
          ],
        },
      ],
    }
  })

  afterEach(cleanup)

  it('dispatches a versioned employee replacement from an edited rendered cell', () => {
    render(<TabelMatrixTable node={node} />)

    const cell = screen.getByLabelText('7-3-2026-02-01')
    fireEvent.change(cell, { target: { value: '7' } })
    fireEvent.blur(cell)

    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'EVENT',
        sourceNodeId: 'table.uchetRabochegoVremeni.matrix',
        trigger: 'change',
        value: expect.objectContaining({
          type: 'REPLACE_EMPLOYEE',
          baseGeneration: 8,
          employeeNodeId: 'employee:7',
          employee: {
            employeeRef: 7,
            workKinds: [
              expect.objectContaining({
                kindNodeId: 'work-kind:7:3',
                cells: { '2026-02-01': '7' },
              }),
            ],
          },
        }),
      })
    )
  })

  it('serializes matrix events until the authoritative generation returns', () => {
    let resolveDispatch: ((result: boolean) => void) | undefined
    dispatch.mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveDispatch = resolve
        })
    )
    render(<TabelMatrixTable node={node} />)

    const employee = screen.getByText('Aruzhan')
    fireEvent.click(employee)
    fireEvent.click(employee)

    expect(dispatch).toHaveBeenCalledTimes(1)

    act(() => {
      resolveDispatch?.(true)
    })
  })
})
