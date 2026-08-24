import type { ViewNode } from '../../../types/view'

/**
 * Contract marker for the 1C-style Tabel matrix.
 *
 * This is intentionally a Tabel-specific presentation, not a generic table
 * mode. A future hierarchical-table task must read ADR-0045 in webbuh before
 * reusing or extracting it. Generalisation is allowed only when a second
 * consumer needs editable child cells, read-only aggregate parents, stable
 * row identity, multi-column hierarchy, and the same event lifecycle.
 *
 * The renderer belongs inside the existing Tabel SDUI TABLE route. Do not add
 * a second page or route for Tabel.
 */
export const TABEL_MATRIX_PRESENTATION = 'TABEL_MATRIX' as const
export const TABEL_MATRIX_WIRE_VERSION = 'tabel-matrix/v1' as const

export interface TabelMatrixInterval {
  start: string
  end: string
}

export interface TabelMatrixWorkKind {
  kindNodeId: string
  workTimeKindRef: number
  workTimeKindPresentation?: string
  protected: boolean
  protectionCode?: string
  cells: Record<string, string>
  total: string
}

export interface TabelMatrixEmployee {
  employeeNodeId: string
  employeeRef: number
  employeePresentation?: string
  dayTotals: Record<string, string>
  total: string
  workKinds: TabelMatrixWorkKind[]
}

/** The complete server-owned representation consumed by the Tabel renderer. */
export interface TabelMatrixPayload {
  wireVersion: typeof TABEL_MATRIX_WIRE_VERSION
  generation: number
  interval: TabelMatrixInterval
  employees: TabelMatrixEmployee[]
  manualWorkKinds: { workTimeKindRef: number; presentation: string }[]
}

/** One optimistic-free employee subtree replacement sent by the matrix editor. */
export interface TabelMatrixReplaceEmployeeCommand {
  type: 'REPLACE_EMPLOYEE'
  operationId: string
  baseGeneration: number
  employeeNodeId: string
  employee: Pick<TabelMatrixEmployee, 'employeeRef' | 'workKinds'>
}

/** Selects an employee for existing row-scoped Tabel commands without exposing raw row ids. */
export interface TabelMatrixSelectEmployeeCommand {
  type: 'SELECT_EMPLOYEE'
  baseGeneration: number
  employeeRef: number
}

/** Deletes the selected level-one employee row and its semantic child rows. */
export interface TabelMatrixDeleteEmployeeCommand {
  type: 'DELETE_EMPLOYEE'
  operationId: string
  baseGeneration: number
  employeeNodeId: string
  employeeRef: number
}

/** Adds several server-authorised employees through the 1C-style picker in one revision. */
export interface TabelMatrixAddEmployeesCommand {
  type: 'ADD_EMPLOYEES'
  operationId: string
  baseGeneration: number
  employeeRefs: number[]
}

/** Server-owned identity and hierarchy visible to the matrix renderer. */
export interface TabelMatrixRow {
  /** Stable semantic row key; never a packed persistence-row id. */
  rowKey: string
  parentRowKey?: string
  level: 0 | 1
  /** Aggregate employee rows are read-only; work-time-kind rows are editable. */
  editable: boolean
  /** Values are rendered by column binding; the browser does not pack them. */
  cells: Record<string, unknown>
}

/**
 * Returns true only for the future, explicitly versioned Tabel matrix wire.
 * Existing flat Tabel TABLE payloads must keep using the current renderer.
 */
export function isTabelMatrixNode(node: ViewNode): boolean {
  return (
    node.props?.sourceBinding === 'UchetRabochegoVremeni' &&
    node.props.tablePresentation === TABEL_MATRIX_PRESENTATION &&
    node.props.tableWireVersion === TABEL_MATRIX_WIRE_VERSION
  )
}

export function isTabelMatrixPayload(
  value: unknown
): value is TabelMatrixPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<TabelMatrixPayload>
  return (
    payload.wireVersion === TABEL_MATRIX_WIRE_VERSION &&
    typeof payload.generation === 'number' &&
    Array.isArray(payload.employees) &&
    Array.isArray(payload.manualWorkKinds) &&
    !!payload.interval &&
    typeof payload.interval.start === 'string' &&
    typeof payload.interval.end === 'string'
  )
}
