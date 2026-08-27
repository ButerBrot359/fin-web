import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../../types/view'
import {
  isTabelMatrixNode,
  parseTabelMatrixPayload,
} from './tabel-matrix-contract'

const matrixNode = (over?: Record<string, unknown>): ViewNode =>
  ({
    id: 'table.uchetRabochegoVremeni',
    type: 'TABLE',
    binding: 'tabel.matrix',
    props: {
      sourceBinding: 'UchetRabochegoVremeni',
      tablePresentation: 'TABEL_MATRIX',
      tableWireVersion: 'tabel-matrix/v1',
      ...over,
    },
  }) as unknown as ViewNode

export const validPayload = {
  wireVersion: 'tabel-matrix/v1',
  generation: 17,
  interval: { start: '2026-08-01', end: '2026-08-31' },
  employees: [
    {
      employeeNodeId: 'employee:42',
      employeeRef: 42,
      employeePresentation: 'Иванов И. И.',
      dayTotals: { '2026-08-12': '8' },
      total: '8',
      workKinds: [
        {
          kindNodeId: 'kind:42:101',
          workTimeKindRef: 101,
          workTimeKindPresentation: 'Явка',
          protected: false,
          cells: { '2026-08-12': '8' },
          total: '8',
        },
        {
          kindNodeId: 'kind:42:200',
          workTimeKindRef: 200,
          workTimeKindPresentation: 'Отпуск',
          protected: true,
          protectionCode: 'HR',
          cells: {},
          total: '',
        },
      ],
    },
  ],
  manualWorkKinds: [{ workTimeKindRef: 101, presentation: 'Явка' }],
}

describe('isTabelMatrixNode: все три признака дискриминатора (spec v1 §2)', () => {
  it('полный набор признаков → матрица', () => {
    expect(isTabelMatrixNode(matrixNode())).toBe(true)
  })

  it.each([
    ['sourceBinding', { sourceBinding: 'Other' }],
    ['tablePresentation', { tablePresentation: 'GRID' }],
    ['tableWireVersion', { tableWireVersion: 'tabel-matrix/v2' }],
  ])('расхождение %s → обычная таблица', (_name, over) => {
    expect(isTabelMatrixNode(matrixNode(over))).toBe(false)
  })

  it('узел без props → не матрица', () => {
    expect(
      isTabelMatrixNode({ id: 'x', type: 'TABLE' } as unknown as ViewNode)
    ).toBe(false)
  })
})

describe('parseTabelMatrixPayload', () => {
  it('валидный payload проходит с типами', () => {
    const parsed = parseTabelMatrixPayload(validPayload)
    expect(parsed).not.toBeNull()
    expect(parsed?.generation).toBe(17)
    expect(parsed?.employees[0].workKinds[1].protected).toBe(true)
  })

  it('незнакомая wireVersion → null (не пытаемся декодировать)', () => {
    expect(
      parseTabelMatrixPayload({ ...validPayload, wireVersion: 'v2' })
    ).toBeNull()
  })

  it('битая форма → null', () => {
    expect(parseTabelMatrixPayload(null)).toBeNull()
    expect(parseTabelMatrixPayload('str')).toBeNull()
    expect(
      parseTabelMatrixPayload({ ...validPayload, generation: '17' })
    ).toBeNull()
    expect(
      parseTabelMatrixPayload({ ...validPayload, employees: [{ bad: true }] })
    ).toBeNull()
    expect(
      parseTabelMatrixPayload({ ...validPayload, interval: null })
    ).toBeNull()
  })
})
