import { describe, expect, it } from 'vitest'

import {
  parseReportSheetPayload,
  type ReportSheetPayload,
} from './report-sheet-contract'
import {
  buildEditCell,
  buildReportSheetRows,
  findReportCell,
  formatReportValue,
  gridFractionDigits,
  isCellEditable,
  normalizeReportInput,
} from './report-sheet-logic'
import {
  EMPTY_PAYLOAD,
  HANDOFF_PAYLOAD,
  RICH_PAYLOAD,
} from './report-sheet-fixtures'

const parse = (raw: unknown): ReportSheetPayload => {
  const p = parseReportSheetPayload(raw)
  if (!p) throw new Error('fixture must parse')
  return p
}

describe('buildReportSheetRows: payload → модель сетки', () => {
  it('группа без ячеек, строка — ячейки по порядку граф', () => {
    const rows = buildReportSheetRows(parse(HANDOFF_PAYLOAD))
    expect(rows.map((r) => r.kind)).toEqual(['group', 'stroka'])
    expect(rows[0]).toMatchObject({
      kod: '010',
      nameRu: 'Нефинансовые активы',
      uroven: 1,
    })
    const stroka = rows[1]
    if (stroka.kind !== 'stroka') throw new Error('stroka expected')
    expect(stroka.cells.map((c) => c?.pokazatelId)).toEqual([4501, 4502])
  })

  it('нет показателя на пересечении — null в позиции графы', () => {
    const rows = buildReportSheetRows(parse(RICH_PAYLOAD))
    const itog = rows.find((r) => r.kind === 'stroka' && r.kod === '199')
    if (itog?.kind !== 'stroka') throw new Error('stroka 199 expected')
    expect(itog.cells.map((c) => c?.pokazatelId ?? null)).toEqual([null, 4599])
  })

  it('раскрытие — сразу под своей строкой, уровнем глубже', () => {
    const rows = buildReportSheetRows(parse(RICH_PAYLOAD))
    const i = rows.findIndex((r) => r.kind === 'stroka' && r.kod === '112')
    const next = rows[i + 1]
    expect(next.kind).toBe('raskrytie')
    if (next.kind !== 'raskrytie') return
    expect(next.indeks).toBe(1)
    expect(next.uroven).toBe(3)
    expect(next.cells.map((c) => c?.indeks ?? null)).toEqual([1, null])
  })

  it('пустой payload — пустой список строк', () => {
    expect(buildReportSheetRows(parse(EMPTY_PAYLOAD))).toEqual([])
  })
})

describe('findReportCell: ячейка по адресу {pokazatelId, indeks}', () => {
  const payload = parse(RICH_PAYLOAD)

  it('итог (индекс 0) и строка раскрытия того же показателя различаются', () => {
    expect(
      findReportCell(payload, { pokazatelId: 4511, indeks: 0 })?.znachenie
    ).toBe('5000.5')
    expect(
      findReportCell(payload, { pokazatelId: 4511, indeks: 1 })?.znachenie
    ).toBe('3000')
  })

  it('неизвестный адрес и пустая сетка — null', () => {
    expect(findReportCell(payload, { pokazatelId: 4511, indeks: 9 })).toBeNull()
    expect(
      findReportCell(parse(EMPTY_PAYLOAD), { pokazatelId: 4501, indeks: 0 })
    ).toBeNull()
  })
})

describe('форматирование и ввод чисел', () => {
  it('точность сетки — по самой точной ячейке', () => {
    expect(gridFractionDigits(parse(HANDOFF_PAYLOAD))).toBe(0)
    expect(gridFractionDigits(parse(RICH_PAYLOAD))).toBe(1)
    expect(gridFractionDigits(parse(EMPTY_PAYLOAD))).toBe(0)
  })

  it('денежный показ: разряды пробелами, запятая, фиксированная точность', () => {
    expect(formatReportValue('120000', 0)).toBe('120 000')
    expect(formatReportValue('120000', 2)).toBe('120 000,00')
    expect(formatReportValue('-551000.5', 2)).toBe('-551 000,50')
    expect(formatReportValue(null, 2)).toBe('')
  })

  it('ввод: разряды и запятая снимаются, пусто — ноль, мусор отклоняется', () => {
    expect(normalizeReportInput('123,45')).toEqual({
      ok: true,
      value: '123.45',
    })
    expect(normalizeReportInput('1 350 000,00')).toEqual({
      ok: true,
      value: '1350000.00',
    })
    expect(normalizeReportInput('-7')).toEqual({ ok: true, value: '-7' })
    expect(normalizeReportInput('  ')).toEqual({ ok: true, value: '0' })
    expect(normalizeReportInput('12a')).toEqual({ ok: false })
    expect(normalizeReportInput('1,2,3')).toEqual({ ok: false })
  })
})

describe('buildEditCell: EDIT_CELL по свежему payload', () => {
  const payload = parse(RICH_PAYLOAD)

  it('заполняемая ячейка — команда с адресом и decimal-строкой', () => {
    expect(
      buildEditCell(payload, { pokazatelId: 4501, indeks: 0 }, '123.45')
    ).toEqual({
      type: 'EDIT_CELL',
      pokazatelId: 4501,
      indeks: 0,
      value: '123.45',
    })
  })

  it('строка раскрытия адресуется своим индексом', () => {
    expect(
      buildEditCell(payload, { pokazatelId: 4511, indeks: 1 }, '10')
    ).toMatchObject({
      pokazatelId: 4511,
      indeks: 1,
    })
  })

  it('без изменения, вычисляемая, закрытая сервером или исчезнувшая — null', () => {
    expect(
      buildEditCell(payload, { pokazatelId: 4501, indeks: 0 }, '120000.00')
    ).toBeNull()
    expect(
      buildEditCell(payload, { pokazatelId: 4599, indeks: 0 }, '1')
    ).toBeNull()
    expect(
      buildEditCell(payload, { pokazatelId: 1, indeks: 0 }, '1')
    ).toBeNull()

    const locked = structuredClone(HANDOFF_PAYLOAD)
    for (const c of locked.stroki[1].cells) c.redaktiruemaya = false
    expect(
      buildEditCell(parse(locked), { pokazatelId: 4501, indeks: 0 }, '1')
    ).toBeNull()
  })

  it('isCellEditable: сервер разрешает И показатель не вычисляемый', () => {
    const cell = findReportCell(payload, { pokazatelId: 4501, indeks: 0 })!
    expect(isCellEditable(cell)).toBe(true)
    expect(isCellEditable({ ...cell, redaktiruemaya: false })).toBe(false)
    expect(isCellEditable({ ...cell, vid: 'VYCHISLYAEMYY' })).toBe(false)
    expect(isCellEditable({ ...cell, vid: 'STROKOVYY' })).toBe(true)
  })
})
