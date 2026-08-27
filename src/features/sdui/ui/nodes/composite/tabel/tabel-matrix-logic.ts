import { addDays, format, getDay, parseISO } from 'date-fns'

import { formatDate } from '@/shared/lib/utils/date'

import type {
  ReplaceEmployeeCommand,
  TabelEmployee,
  TabelMatrixPayload,
} from './tabel-matrix-contract'

/** Все ISO-даты interval.start..interval.end включительно (spec v1 §5). */
export function listIntervalDays(interval: {
  start: string
  end: string
}): string[] {
  const start = parseISO(interval.start)
  const end = parseISO(interval.end)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []
  const days: string[] = []
  for (
    let d = start;
    d <= end && days.length < 40; // защита от битого интервала: месяц ≤ 31 дня
    d = addDays(d, 1)
  ) {
    days.push(format(d, 'yyyy-MM-dd'))
  }
  return days
}

export interface DayHeader {
  iso: string
  dayNum: string
  weekday: string
  weekend: boolean
}

/** Заголовок дня `12 Ср`; суббота/воскресенье помечаются weekend (§5).
 * Локаль дня недели — из i18n (ru/kk) через общий formatDate. */
export function dayHeader(iso: string): DayHeader {
  const date = parseISO(iso)
  const dow = getDay(date)
  const weekday = formatDate(date, 'EEEEEE')
  return {
    iso,
    dayNum: format(date, 'd'),
    weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1),
    weekend: dow === 0 || dow === 6,
  }
}

/** Компактное отображение часов: "8.0" → "8", "7.50" → "7.5" (§5). */
export function formatHours(value: string | undefined): string {
  if (!value) return ''
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return value
  const normalized = value.trim().replace(',', '.')
  const num = Number(normalized)
  if (Number.isNaN(num)) return value
  // До двух знаков, без хвостовых нулей — не показываем storage precision
  return String(Math.round(num * 100) / 100)
}

export type NormalizedCellInput =
  | { ok: true; value: string | null }
  | { ok: false }

/**
 * Нормализация пользовательского ввода ячейки. Пусто → value:null (удаление
 * ячейки: отсутствие значения, не «0»). Число вне 1..24 или мусор → ok:false —
 * не отправляем заведомый отказ, показываем текст серверного правила локально.
 */
export function normalizeCellInput(raw: string): NormalizedCellInput {
  const trimmed = raw.trim()
  if (trimmed === '') return { ok: true, value: null }
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) return { ok: false }
  const num = Number(trimmed.replace(',', '.'))
  if (Number.isNaN(num) || num < 1 || num > 24) return { ok: false }
  return { ok: true, value: String(Math.round(num * 100) / 100) }
}

/** Число дней с часами у вида времени — для итога в 1С-стиле (§5). */
export function countKindDays(cells: Record<string, string>): number {
  return Object.values(cells).filter((v) => v.trim() !== '').length
}

export interface CellEdit {
  workTimeKindRef: number
  date: string
  /** null — очистить ячейку. */
  value: string | null
}

/**
 * Полный replacement subtree сотрудника с применённой правкой ячейки (§4):
 * отправляются ВСЕ виды времени, включая protected, — это не partial patch.
 * Черновые (ещё не сохранённые) виды передаются через draftKindRefs.
 */
export function buildReplaceEmployee(
  payload: TabelMatrixPayload,
  employeeNodeId: string,
  edit: CellEdit | null,
  draftKindRefs: number[] = []
): ReplaceEmployeeCommand | null {
  const employee = payload.employees.find(
    (e) => e.employeeNodeId === employeeNodeId
  )
  if (!employee) return null

  const workKinds = employee.workKinds.map((kind) => {
    if (edit?.workTimeKindRef !== kind.workTimeKindRef) {
      return { workTimeKindRef: kind.workTimeKindRef, cells: { ...kind.cells } }
    }
    // Правка ячейки: пересборка без dynamic delete — отсутствие ключа и есть
    // «пустая ячейка» по контракту
    const cells = Object.fromEntries(
      Object.entries(kind.cells).filter(([date]) => date !== edit.date)
    )
    if (edit.value !== null) cells[edit.date] = edit.value
    return { workTimeKindRef: kind.workTimeKindRef, cells }
  })

  // Черновые виды, которых ещё нет в серверном payload
  const existingRefs = new Set(workKinds.map((k) => k.workTimeKindRef))
  for (const ref of draftKindRefs) {
    if (existingRefs.has(ref)) continue
    const cells: Record<string, string> = {}
    if (edit?.workTimeKindRef === ref && edit.value !== null) {
      cells[edit.date] = edit.value
    }
    workKinds.push({ workTimeKindRef: ref, cells })
  }

  return {
    type: 'REPLACE_EMPLOYEE',
    baseGeneration: payload.generation,
    employeeNodeId,
    employee: { employeeRef: employee.employeeRef, workKinds },
  }
}

/**
 * Фолбэк подписей видов времени: сервер может не прислать
 * `workTimeKindPresentation` (наблюдалось после REPLACE/ADD) — подставляем
 * презентацию из `manualWorkKinds` по ref, чтобы не показывать голый id.
 */
export function withKindPresentations(
  payload: TabelMatrixPayload
): TabelMatrixPayload {
  const names = new Map(
    payload.manualWorkKinds.map((k) => [k.workTimeKindRef, k.presentation])
  )
  const employees = payload.employees.map((employee) => {
    const workKinds = employee.workKinds.map((kind) => {
      const name = names.get(kind.workTimeKindRef)
      if (kind.workTimeKindPresentation || name === undefined) return kind
      return { ...kind, workTimeKindPresentation: name }
    })
    const changed = workKinds.some((k, i) => k !== employee.workKinds[i])
    return changed ? { ...employee, workKinds } : employee
  })
  const changed = employees.some((e, i) => e !== payload.employees[i])
  return changed ? { ...payload, employees } : payload
}

/** Сотрудники, отфильтрованные локальным поиском по presentation (§5). */
export function filterEmployees(
  employees: TabelEmployee[],
  query: string
): TabelEmployee[] {
  const q = query.trim().toLowerCase()
  if (!q) return employees
  return employees.filter((e) =>
    (e.employeePresentation ?? String(e.employeeRef)).toLowerCase().includes(q)
  )
}
