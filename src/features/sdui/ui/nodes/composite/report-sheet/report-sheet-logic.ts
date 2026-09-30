import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import {
  EDIT_CELL,
  VID_VYCHISLYAEMYY,
  type EditCellCommand,
  type ReportCellAddress,
  type ReportSheetCell,
  type ReportSheetPayload,
} from './report-sheet-contract'

/** Ячейка на пересечении строки грида и графы; null — показателя нет. */
export type ReportGridCell = ReportSheetCell | null

export type ReportSheetRow =
  | { kind: 'group'; key: string; kod: string; nameRu: string; uroven: number }
  | {
      kind: 'stroka'
      key: string
      kod: string
      nameRu: string
      uroven: number
      cells: ReportGridCell[]
    }
  | {
      kind: 'raskrytie'
      key: string
      indeks: number
      /** Уровень строки-владельца + 1: раскрытие рисуется под ней с отступом. */
      uroven: number
      cells: ReportGridCell[]
    }

/** Ячейки строки → массив по порядку граф (выравнивание по kolonkaKod). */
function alignToGrafy(
  cells: ReportSheetCell[],
  grafaKody: string[]
): ReportGridCell[] {
  const byKolonka = new Map(cells.map((c) => [c.kolonkaKod, c]))
  return grafaKody.map((kod) => byKolonka.get(kod) ?? null)
}

/**
 * Payload → плоский список строк грида: группа (заголовок раздела без
 * ячеек), строка показателей, её строки раскрытия сразу под ней. Порядок —
 * как в структуре редакции, иерархия — только отступом по uroven.
 */
export function buildReportSheetRows(
  payload: ReportSheetPayload
): ReportSheetRow[] {
  const grafaKody = payload.grafy.map((g) => g.kod)
  const rows: ReportSheetRow[] = []
  payload.stroki.forEach((s, i) => {
    const key = `${String(i)}:${s.kod}`
    if (s.isGroup) {
      rows.push({
        kind: 'group',
        key,
        kod: s.kod,
        nameRu: s.nameRu,
        uroven: s.uroven,
      })
      return
    }
    rows.push({
      kind: 'stroka',
      key,
      kod: s.kod,
      nameRu: s.nameRu,
      uroven: s.uroven,
      cells: alignToGrafy(s.cells, grafaKody),
    })
    for (const r of s.raskrytie) {
      rows.push({
        kind: 'raskrytie',
        key: `${key}:${String(r.indeks)}`,
        indeks: r.indeks,
        uroven: s.uroven + 1,
        cells: alignToGrafy(r.cells, grafaKody),
      })
    }
  })
  return rows
}

/** Ячейка по адресу {pokazatelId, indeks} — в итогах и в раскрытии. */
export function findReportCell(
  payload: ReportSheetPayload,
  address: ReportCellAddress
): ReportSheetCell | null {
  const match = (c: ReportSheetCell) =>
    c.pokazatelId === address.pokazatelId && c.indeks === address.indeks
  for (const s of payload.stroki) {
    const hit =
      s.cells.find(match) ?? s.raskrytie.flatMap((r) => r.cells).find(match)
    if (hit) return hit
  }
  return null
}

/**
 * Можно ли править ячейку в UI: сервер разрешает (redaktiruemaya) и
 * показатель не вычисляемый — вычисляемые пересчитываются из операндов и
 * показываются только для чтения (как в 1С без режима ручной правки).
 */
export function isCellEditable(cell: ReportSheetCell): boolean {
  return cell.redaktiruemaya && cell.vid !== VID_VYCHISLYAEMYY
}

const MAX_FRACTION_DIGITS = 6

const fractionOf = (value: string | null): number => {
  if (value == null) return 0
  const dot = value.indexOf('.')
  return dot < 0 || /e/i.test(value) ? 0 : value.length - dot - 1
}

/**
 * Точность сетки: наибольшее число знаков после запятой среди значений.
 * Провод не несёт точность отчёта, а BigDecimal через JSON-число теряет
 * хвостовые нули — выравниваем все ячейки по самой точной (123,4 → 123,40).
 */
export function gridFractionDigits(payload: ReportSheetPayload): number {
  let digits = 0
  for (const s of payload.stroki) {
    for (const c of [...s.cells, ...s.raskrytie.flatMap((r) => r.cells)]) {
      digits = Math.max(digits, fractionOf(c.znachenie))
    }
  }
  return Math.min(digits, MAX_FRACTION_DIGITS)
}

/** Денежный показ SDUI: разряды пробелами, запятая, фиксированная точность. */
export function formatReportValue(
  value: string | null,
  fractionDigits: number
): string {
  if (value == null) return ''
  const n = Number(value)
  if (!Number.isFinite(n)) return value
  return formatWithSpaces(n.toFixed(fractionDigits))
}

export type ReportInput = { ok: true; value: string } | { ok: false }

const DECIMAL = /^-?\d+(\.\d+)?$/

/**
 * Ввод пользователя → decimal-строка провода. Разряды (пробелы, в т.ч.
 * неразрывные — \s их покрывает) убираются, запятая — десятичный разделитель; пусто — 0
 * (очистка числовой ячейки в 1С обнуляет показатель).
 */
export function normalizeReportInput(raw: string): ReportInput {
  const compact = raw.replace(/\s/g, '').replace(',', '.')
  if (compact === '') return { ok: true, value: '0' }
  return DECIMAL.test(compact) ? { ok: true, value: compact } : { ok: false }
}

/**
 * EDIT_CELL по СВЕЖЕМУ payload (голова очереди): ячейка исчезла, стала
 * нередактируемой или значение не изменилось — команду не шлём (null).
 */
export function buildEditCell(
  payload: ReportSheetPayload,
  address: ReportCellAddress,
  value: string
): EditCellCommand | null {
  const cell = findReportCell(payload, address)
  if (!cell || !isCellEditable(cell)) return null
  if (cell.znachenie != null && Number(cell.znachenie) === Number(value)) {
    return null
  }
  return {
    type: EDIT_CELL,
    pokazatelId: address.pokazatelId,
    indeks: address.indeks,
    value,
  }
}
