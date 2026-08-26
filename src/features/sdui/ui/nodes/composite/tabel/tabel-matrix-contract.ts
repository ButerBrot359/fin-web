import type { ViewNode } from '../../../../types/view'

// Wire-контракт матрицы Табеля (SCRUM-276 spec v1 §2–§4). Бэк отдаёт ТЧ
// UchetRabochegoVremeni семантической матрицей сотрудник → вид времени → дни;
// packed-строки хранения (rowId, Chasy1..31) в браузер не попадают.

export const TABEL_MATRIX_WIRE_VERSION = 'tabel-matrix/v1'
const TABEL_MATRIX_PRESENTATION = 'TABEL_MATRIX'
const TABEL_MATRIX_SOURCE_BINDING = 'UchetRabochegoVremeni'

export interface TabelWorkKind {
  kindNodeId: string
  workTimeKindRef: number
  workTimeKindPresentation?: string
  protected: boolean
  protectionCode?: string
  /** ISO-дата → decimal-строка часов. Отсутствие ключа = пустая ячейка, не «0». */
  cells: Record<string, string>
  total: string
}

export interface TabelEmployee {
  /** Строго `employee:<employeeRef>` — семантический ключ, не storage id. */
  employeeNodeId: string
  employeeRef: number
  employeePresentation?: string
  dayTotals: Record<string, string>
  total: string
  workKinds: TabelWorkKind[]
}

export interface TabelManualWorkKind {
  workTimeKindRef: number
  presentation: string
}

export interface TabelMatrixPayload {
  wireVersion: typeof TABEL_MATRIX_WIRE_VERSION
  /** Compare-and-set токен сервера; не browser revision. */
  generation: number
  /** ISO-даты включительно, ровно один календарный месяц. */
  interval: { start: string; end: string }
  employees: TabelEmployee[]
  /** Единственный источник списка «Добавить вид времени». */
  manualWorkKinds: TabelManualWorkKind[]
}

// Команды мутаций (§4). baseGeneration подставляет очередь в момент отправки.
export interface ReplaceEmployeeCommand {
  type: 'REPLACE_EMPLOYEE'
  baseGeneration: number
  employeeNodeId: string
  employee: {
    employeeRef: number
    workKinds: {
      workTimeKindRef: number
      cells: Record<string, string>
    }[]
  }
}

export interface DeleteWorkKindCommand {
  type: 'DELETE_WORK_KIND'
  baseGeneration: number
  employeeNodeId: string
  employeeRef: number
  workTimeKindRef: number
}

export interface AddEmployeeCommand {
  type: 'ADD_EMPLOYEE'
  baseGeneration: number
  employeeRef: number
}

export interface AddEmployeesCommand {
  type: 'ADD_EMPLOYEES'
  baseGeneration: number
  employeeRefs: number[]
}

export interface SelectEmployeeCommand {
  type: 'SELECT_EMPLOYEE'
  baseGeneration: number
  employeeRef: number
}

export interface DeleteEmployeeCommand {
  type: 'DELETE_EMPLOYEE'
  baseGeneration: number
  employeeNodeId: string
  employeeRef: number
}

export type TabelMatrixCommand =
  | ReplaceEmployeeCommand
  | DeleteWorkKindCommand
  | AddEmployeeCommand
  | AddEmployeesCommand
  | SelectEmployeeCommand
  | DeleteEmployeeCommand

/**
 * Дискриминатор матрицы — все ТРИ признака одновременно (spec v1 §2).
 * Запрещено определять матрицу по подписи, порядку узлов или числу колонок.
 * Не совпало → обычный TABLE-рендерер, без попыток декодировать packed-строки.
 */
export function isTabelMatrixNode(node: ViewNode): boolean {
  const p = node.props
  return (
    p?.sourceBinding === TABEL_MATRIX_SOURCE_BINDING &&
    p.tablePresentation === TABEL_MATRIX_PRESENTATION &&
    p.tableWireVersion === TABEL_MATRIX_WIRE_VERSION
  )
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const isStringMap = (v: unknown): v is Record<string, string> =>
  isRecord(v) && Object.values(v).every((x) => typeof x === 'string')

function isWorkKind(v: unknown): v is TabelWorkKind {
  return (
    isRecord(v) &&
    typeof v.kindNodeId === 'string' &&
    typeof v.workTimeKindRef === 'number' &&
    typeof v.protected === 'boolean' &&
    isStringMap(v.cells) &&
    typeof v.total === 'string'
  )
}

function isEmployee(v: unknown): v is TabelEmployee {
  return (
    isRecord(v) &&
    typeof v.employeeNodeId === 'string' &&
    typeof v.employeeRef === 'number' &&
    isStringMap(v.dayTotals) &&
    typeof v.total === 'string' &&
    Array.isArray(v.workKinds) &&
    v.workKinds.every(isWorkKind)
  )
}

/**
 * Разбор значения binding `tabel.matrix`. Незнакомая wireVersion или битая
 * форма → null: рендерер показывает «данные недоступны», команды не шлются.
 */
export function parseTabelMatrixPayload(
  value: unknown
): TabelMatrixPayload | null {
  if (!isRecord(value)) return null
  if (value.wireVersion !== TABEL_MATRIX_WIRE_VERSION) return null
  if (typeof value.generation !== 'number' || value.generation < 0) return null
  const interval = value.interval
  if (
    !isRecord(interval) ||
    typeof interval.start !== 'string' ||
    typeof interval.end !== 'string'
  ) {
    return null
  }
  if (!Array.isArray(value.employees) || !value.employees.every(isEmployee)) {
    return null
  }
  const manual = value.manualWorkKinds
  if (
    !Array.isArray(manual) ||
    !manual.every(
      (m) =>
        isRecord(m) &&
        typeof m.workTimeKindRef === 'number' &&
        typeof m.presentation === 'string'
    )
  ) {
    return null
  }
  return value as unknown as TabelMatrixPayload
}
