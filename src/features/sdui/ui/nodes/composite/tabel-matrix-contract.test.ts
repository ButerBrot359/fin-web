import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../types/view'
import {
  isTabelMatrixPayload,
  isTabelMatrixNode,
  TABEL_MATRIX_PRESENTATION,
  TABEL_MATRIX_WIRE_VERSION,
} from './tabel-matrix-contract'

describe('Tabel matrix contract marker', () => {
  it('recognises only the explicit Tabel table presentation', () => {
    const node = {
      id: 'table.uchetRabochegoVremeni',
      type: 'TABLE',
      binding: 'tabel.matrix',
      props: {
        sourceBinding: 'UchetRabochegoVremeni',
        tablePresentation: TABEL_MATRIX_PRESENTATION,
        tableWireVersion: TABEL_MATRIX_WIRE_VERSION,
      },
    } as ViewNode

    expect(isTabelMatrixNode(node)).toBe(true)
  })

  it('does not reinterpret the existing flat Tabel table as a matrix', () => {
    const node = {
      id: 'table.uchetRabochegoVremeni',
      type: 'TABLE',
      binding: 'UchetRabochegoVremeni',
      props: { editable: true },
    } as ViewNode

    expect(isTabelMatrixNode(node)).toBe(false)
  })

  it('accepts only the versioned matrix envelope', () => {
    expect(
      isTabelMatrixPayload({
        wireVersion: TABEL_MATRIX_WIRE_VERSION,
        generation: 41,
        interval: { start: '2026-08-01', end: '2026-08-31' },
        employees: [],
        manualWorkKinds: [],
      })
    ).toBe(true)

    expect(
      isTabelMatrixPayload({
        wireVersion: 'tabel-matrix/v0',
        generation: 41,
        interval: { start: '2026-08-01', end: '2026-08-31' },
        employees: [],
        manualWorkKinds: [],
      })
    ).toBe(false)
  })
})
