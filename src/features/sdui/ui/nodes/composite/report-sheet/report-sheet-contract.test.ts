import { describe, expect, it } from 'vitest'

import type { ViewNode } from '../../../../types/view'
import {
  isReportSheetNode,
  parseReportSheetPayload,
} from './report-sheet-contract'
import {
  EMPTY_PAYLOAD,
  HANDOFF_PAYLOAD,
  REPORT_SHEET_NODE,
  RICH_PAYLOAD,
} from './report-sheet-fixtures'

const withProps = (props: Record<string, unknown>): ViewNode => ({
  ...REPORT_SHEET_NODE,
  props,
})

describe('isReportSheetNode: дискриминатор report-sheet/v1', () => {
  it('узел из handoff — сетка отчёта', () => {
    expect(isReportSheetNode(REPORT_SHEET_NODE)).toBe(true)
  })

  it('нужны ОБА признака: presentation без версии провода — обычная таблица', () => {
    expect(
      isReportSheetNode(withProps({ tablePresentation: 'REPORT_SHEET' }))
    ).toBe(false)
    expect(
      isReportSheetNode(
        withProps({
          tablePresentation: 'REPORT_SHEET',
          tableWireVersion: 'report-sheet/v2',
        })
      )
    ).toBe(false)
  })

  it('матрица Табеля и узел без пропов — не сетка', () => {
    expect(
      isReportSheetNode(
        withProps({
          sourceBinding: 'UchetRabochegoVremeni',
          tablePresentation: 'TABEL_MATRIX',
          tableWireVersion: 'tabel-matrix/v1',
        })
      )
    ).toBe(false)
    expect(isReportSheetNode({ id: 'x', type: 'TABLE' })).toBe(false)
  })
})

describe('parseReportSheetPayload: разбор value', () => {
  it('фактический payload из handoff: графы, группа, ячейки итога', () => {
    const p = parseReportSheetPayload(HANDOFF_PAYLOAD)
    expect(p).not.toBeNull()
    expect(p?.generation).toBe(0)
    expect(p?.grafy).toEqual([
      {
        kod: '3',
        nameRu: 'На начало отчётного периода',
        nomerPechatnoyGrafy: 3,
      },
      {
        kod: '4',
        nameRu: 'На конец отчётного периода',
        nomerPechatnoyGrafy: 4,
      },
    ])
    expect(p?.stroki[0]).toMatchObject({ kod: '010', isGroup: true, cells: [] })
    // BigDecimal-число провода нормализуется в decimal-строку
    expect(p?.stroki[1].cells[0]).toEqual({
      pokazatelId: 4501,
      kod: 'стр_111_3',
      kolonkaKod: '3',
      indeks: 0,
      znachenie: '120000',
      syroe: '120000',
      vid: 'ZAPOLNYAEMYY',
      redaktiruemaya: true,
      izmenenoVruchnuyu: false,
    })
  })

  it('пустая сетка (рубильник выключен) — валидный payload, не ошибка', () => {
    expect(parseReportSheetPayload(EMPTY_PAYLOAD)).toEqual({
      grafy: [],
      stroki: [],
      generation: 0,
    })
  })

  it('decimal-строка и раскрытие разбираются; null-значение допустимо', () => {
    const p = parseReportSheetPayload(RICH_PAYLOAD)
    expect(p?.stroki[2].cells[0].znachenie).toBe('5000.5')
    expect(p?.stroki[2].raskrytie[0]).toMatchObject({ indeks: 1 })
    expect(p?.stroki[2].raskrytie[0].cells[0].indeks).toBe(1)

    const withNull = structuredClone(HANDOFF_PAYLOAD)
    ;(withNull.stroki[1].cells[0] as Record<string, unknown>).znachenie = null
    expect(
      parseReportSheetPayload(withNull)?.stroki[1].cells[0].znachenie
    ).toBeNull()
  })

  it('битая форма → null: команды по такому payload не шлются', () => {
    expect(parseReportSheetPayload(null)).toBeNull()
    expect(parseReportSheetPayload([])).toBeNull()
    expect(parseReportSheetPayload({ grafy: [], stroki: [] })).toBeNull()
    expect(
      parseReportSheetPayload({ ...EMPTY_PAYLOAD, generation: -1 })
    ).toBeNull()
    expect(parseReportSheetPayload({ ...EMPTY_PAYLOAD, stroki: {} })).toBeNull()

    const noAddress = structuredClone(HANDOFF_PAYLOAD)
    delete (noAddress.stroki[1].cells[0] as Record<string, unknown>).pokazatelId
    expect(parseReportSheetPayload(noAddress)).toBeNull()

    const badValue = structuredClone(HANDOFF_PAYLOAD)
    ;(badValue.stroki[1].cells[0] as Record<string, unknown>).znachenie = 'abc'
    expect(parseReportSheetPayload(badValue)).toBeNull()
  })
})
