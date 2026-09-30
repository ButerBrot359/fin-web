import type { ViewNode } from '../../../../types/view'

// Wire-контракт сетки экземпляра регламентированного отчёта (report-sheet/v1,
// ADR-0087 §2.9.3, handoff frontend-handoff-konstruktor-report-sheet.md).
// Графы и строки — часть value, не дерева: TABLE_COLUMN у узла нет.

const REPORT_SHEET_PRESENTATION = 'REPORT_SHEET'
const REPORT_SHEET_WIRE_VERSION = 'report-sheet/v1'

/** Дискриминатор EVENT change узла сетки — ручная правка одной ячейки. */
export const EDIT_CELL = 'EDIT_CELL'
/** COMMAND расшифровки показателя (ответ — openDialog с read-only TABLE). */
export const RASSHIFROVKA_COMMAND = 'otchetnost.rasshifrovka'

/** cell.vid — как показатель получил значение (строковый дискриминатор). */
export const VID_VYCHISLYAEMYY = 'VYCHISLYAEMYY'

export interface ReportSheetGrafa {
  kod: string
  nameRu: string
  /** Номер печатной графы бланка; null — не задан. */
  nomerPechatnoyGrafy: number | null
}

/** Адрес ячейки: устойчив и не переиспользуется (правка, расшифровка, ФЛК). */
export interface ReportCellAddress {
  pokazatelId: number
  indeks: number
}

export interface ReportSheetCell extends ReportCellAddress {
  kod: string
  kolonkaKod: string
  /** Масштабированное значение — ПОКАЗЫВАЕТСЯ; decimal-строка или null. */
  znachenie: string | null
  /** Сырое значение регистра (только для подписи/отладки). */
  syroe: string | null
  /** ZAPOLNYAEMYY | VYCHISLYAEMYY | STROKOVYY; незнакомое значение терпим. */
  vid: string
  /** UX-подсказка сервера; авторитетный отказ — на самой команде. */
  redaktiruemaya: boolean
  izmenenoVruchnuyu: boolean
}

export interface ReportSheetRaskrytie {
  indeks: number
  cells: ReportSheetCell[]
}

export interface ReportSheetStroka {
  kod: string
  nameRu: string
  /** 1 — корень строк вида отчёта, 2+ — дети. */
  uroven: number
  /** Заголовок раздела: cells/raskrytie пусты. */
  isGroup: boolean
  /** Ячейки индекса 0 (итог) — по одной на графу, где есть показатель. */
  cells: ReportSheetCell[]
  raskrytie: ReportSheetRaskrytie[]
}

export interface ReportSheetPayload {
  grafy: ReportSheetGrafa[]
  stroki: ReportSheetStroka[]
  /** Ревизия формы на момент сборки — baseGeneration для EDIT_CELL. */
  generation: number
}

/** Тело EVENT change; baseGeneration подставляет очередь в момент отправки. */
export interface EditCellCommand extends ReportCellAddress {
  type: typeof EDIT_CELL
  /** Decimal-строка в единицах отчёта (как cell.znachenie, НЕ syroe). */
  value: string
}

/**
 * Дискриминатор сетки — пара presentation + wireVersion (handoff §TABLE), не
 * binding и не подпись. Не совпало → обычный TABLE-рендерер.
 */
export function isReportSheetNode(node: ViewNode): boolean {
  const p = node.props
  return (
    p?.tablePresentation === REPORT_SHEET_PRESENTATION &&
    p.tableWireVersion === REPORT_SHEET_WIRE_VERSION
  )
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const isIndex = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0

const optString = (v: unknown): string => (typeof v === 'string' ? v : '')

/** BigDecimal с провода: число (Jackson) или строка; null — пусто. */
function toDecimal(v: unknown): string | null | undefined {
  if (v == null) return null
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : undefined
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
    return v.trim()
  }
  return undefined
}

function parseCell(v: unknown): ReportSheetCell | null {
  if (!isRecord(v)) return null
  if (!isIndex(v.pokazatelId) || !isIndex(v.indeks)) return null
  if (typeof v.kolonkaKod !== 'string') return null
  const znachenie = toDecimal(v.znachenie)
  const syroe = toDecimal(v.syroe)
  if (znachenie === undefined || syroe === undefined) return null
  return {
    pokazatelId: v.pokazatelId,
    indeks: v.indeks,
    kod: optString(v.kod),
    kolonkaKod: v.kolonkaKod,
    znachenie,
    syroe,
    vid: optString(v.vid),
    redaktiruemaya: v.redaktiruemaya === true,
    izmenenoVruchnuyu: v.izmenenoVruchnuyu === true,
  }
}

function parseCells(v: unknown): ReportSheetCell[] | null {
  if (!Array.isArray(v)) return null
  const cells = v.map(parseCell)
  return cells.every((c) => c !== null) ? cells : null
}

function parseRaskrytie(v: unknown): ReportSheetRaskrytie | null {
  if (!isRecord(v) || !isIndex(v.indeks)) return null
  const cells = parseCells(v.cells)
  return cells ? { indeks: v.indeks, cells } : null
}

function parseStroka(v: unknown): ReportSheetStroka | null {
  if (!isRecord(v) || typeof v.uroven !== 'number') return null
  const cells = parseCells(v.cells ?? [])
  const rawRaskrytie = v.raskrytie ?? []
  if (!cells || !Array.isArray(rawRaskrytie)) return null
  const raskrytie = rawRaskrytie.map(parseRaskrytie)
  if (!raskrytie.every((r) => r !== null)) return null
  return {
    kod: optString(v.kod),
    nameRu: optString(v.nameRu),
    uroven: v.uroven,
    isGroup: v.isGroup === true,
    cells,
    raskrytie,
  }
}

function parseGrafa(v: unknown): ReportSheetGrafa | null {
  if (!isRecord(v) || typeof v.kod !== 'string') return null
  return {
    kod: v.kod,
    nameRu: optString(v.nameRu),
    nomerPechatnoyGrafy:
      typeof v.nomerPechatnoyGrafy === 'number' ? v.nomerPechatnoyGrafy : null,
  }
}

/**
 * Разбор значения binding сетки. Битая форма → null: рендерер показывает
 * «данные недоступны», команды не шлются. Пустая сетка ({grafy: [],
 * stroki: []} — рубильник выключен или шапка не заполнена) — валидна.
 */
export function parseReportSheetPayload(
  value: unknown
): ReportSheetPayload | null {
  if (!isRecord(value)) return null
  if (!isIndex(value.generation)) return null
  if (!Array.isArray(value.grafy) || !Array.isArray(value.stroki)) return null
  const grafy = value.grafy.map(parseGrafa)
  const stroki = value.stroki.map(parseStroka)
  if (!grafy.every((g) => g !== null) || !stroki.every((s) => s !== null)) {
    return null
  }
  return { grafy, stroki, generation: value.generation }
}
