import { formatWithSpaces } from '@/shared/lib/utils/format-cell-value'

import type { ViewNode } from '../../../types/view'

// Чистая логика 1С-блока проводок бухрегистра (без React).
// Контракт данных — buildAccountingRows (бэк, MovementsComposer): строка
// проводки — плоская Map по binding. Ссылочная ячейка — { id, presentation,
// entityRef }, пустая — "" (не null).

export interface SduiCellObject {
  id?: number | string
  presentation?: string
  entityRef?: { domain?: string; id?: number | string; presentation?: string }
}

export interface AccountingRow {
  rowId: string
  [key: string]: unknown
}

// SCRUM-362 B-3: раскладка 1С-блока приходит ролями-координатами на колонках
// (props.role): blockDt:<строка>:<слот> / blockKt:… — ячейка стороны,
// block:<строка>:<слот> — одна колонка на обеих сторонах («Количество»).
// Слот 0 — всегда субконто. Колонки вне сетки несут смысловые роли (period,
// accountDt/Kt, sum, currencySum, content, organization, active). Биндинг
// остался ключом значения, но для фронта непрозрачен. Захардкоженная
// ROW_LAYOUT-таблица и подсчёт строк по данным (SUBKONTO_RE) удалены.
export interface BlockRowDef {
  subDt: string
  subKt: string
  a1Dt: string
  a1Kt: string
  a2Dt: string
  a2Kt: string
}

/** Колонки вне сетки блока: смысловая роль → биндинг значения. */
export type SemanticBindings = Partial<Record<string, string>>

export interface BlockModel {
  rowDefs: BlockRowDef[]
  semantic: SemanticBindings
}

const BLOCK_ROLE_RE = /^block(Dt|Kt)?:(\d+):(\d+)$/

/**
 * Модель блока из ролей листьев TABLE_COLUMN (алгоритм §2 wave-1 спеки):
 * число строк = максимум номера строки среди block*-ролей; для строки r и
 * слота s колонка — роль block<Side>:r:s либо block:r:s (обе стороны).
 * Клетки без колонок рисуются пустыми.
 */
export function buildBlockModel(tableNode: ViewNode): BlockModel {
  const bySide = new Map<string, string>() // "<Dt|Kt|both>:<r>:<s>" → binding
  const semantic: SemanticBindings = {}
  let rowCount = 0

  const visit = (n: ViewNode): void => {
    if (n.type === 'TABLE_COLUMN') {
      const binding =
        n.binding ?? (n.props?.binding as string | undefined) ?? n.id
      const role = n.props?.role as string | undefined
      if (!role) return
      const m = BLOCK_ROLE_RE.exec(role)
      if (m) {
        // Группа стороны опциональна (block: без стороны — обе сразу)
        const side = (m[1] as string | undefined) ?? 'both'
        rowCount = Math.max(rowCount, Number(m[2]))
        bySide.set(`${side}:${m[2]}:${m[3]}`, binding)
      } else {
        semantic[role] = binding
      }
      return
    }
    if (n.type === 'COLUMN_GROUP') (n.children ?? []).forEach(visit)
  }
  ;(tableNode.children ?? []).forEach(visit)

  const at = (side: 'Dt' | 'Kt', r: number, s: number): string =>
    bySide.get(`${side}:${String(r)}:${String(s)}`) ??
    bySide.get(`both:${String(r)}:${String(s)}`) ??
    ''

  const rowDefs: BlockRowDef[] = Array.from({ length: rowCount }, (_, i) => {
    const r = i + 1
    return {
      subDt: at('Dt', r, 0),
      subKt: at('Kt', r, 0),
      a1Dt: at('Dt', r, 1),
      a1Kt: at('Kt', r, 1),
      a2Dt: at('Dt', r, 2),
      a2Kt: at('Kt', r, 2),
    }
  })

  return { rowDefs, semantic }
}

/** Ссылочная ячейка → presentation; число → разряды; строка как есть; пусто → ''. */
export function resolveCellValue(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'object') {
    return (v as SduiCellObject).presentation ?? ''
  }
  if (typeof v === 'number') return formatWithSpaces(String(v))
  return typeof v === 'string' ? v : String(v as boolean)
}

/** Сумма/количество: бэк шлёт "2000.0000" (toPlainString) → "2 000,00". */
export function formatSum(v: unknown): string {
  if (v == null || v === '') return ''
  const n = Number(v)
  const plain = Number.isFinite(n) ? n.toFixed(2) : String(v as string | number)
  return formatWithSpaces(plain)
}

/** binding → props.label по листьям TABLE_COLUMN (включая вложенные в COLUMN_GROUP). */
export function collectColumnLabels(tableNode: ViewNode): Map<string, string> {
  const map = new Map<string, string>()
  const visit = (n: ViewNode): void => {
    if (n.type === 'TABLE_COLUMN') {
      const binding =
        n.binding ?? (n.props?.binding as string | undefined) ?? n.id
      map.set(binding, (n.props?.label as string | undefined) ?? '')
      return
    }
    if (n.type === 'COLUMN_GROUP') (n.children ?? []).forEach(visit)
  }
  ;(tableNode.children ?? []).forEach(visit)
  return map
}

/** Метки COLUMN_GROUP верхнего уровня в порядке документа (ДЕБЕТ, КРЕДИТ). */
export function collectGroupLabels(tableNode: ViewNode): string[] {
  return (tableNode.children ?? [])
    .filter((c) => c.type === 'COLUMN_GROUP')
    .map((c) => (c.props?.label as string | undefined) ?? '')
}
