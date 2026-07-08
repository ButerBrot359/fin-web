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

// Раскладка 1С-блока по строкам (§1.3 спеки), side-specific ключи:
//  строка 1: Субконто1 · ФКР · Подразделение
//  строка 2: Субконто2 · Специфика · Количество
//  строка 3: Субконто3 · Источник финансирования · Код платных услуг
export interface BlockRowDef {
  subDt: string
  subKt: string
  a1Dt: string
  a1Kt: string
  a2Dt: string
  a2Kt: string
}

export const ROW_LAYOUT: BlockRowDef[] = [
  {
    subDt: '_subkontoDt1',
    subKt: '_subkontoKt1',
    a1Dt: '_fkrDt',
    a1Kt: '_fkrKt',
    a2Dt: '_podrazdelenieDt',
    a2Kt: '_podrazdelenieKt',
  },
  {
    subDt: '_subkontoDt2',
    subKt: '_subkontoKt2',
    a1Dt: '_spetsifikaDt',
    a1Kt: '_spetsifikaKt',
    a2Dt: '_kolichestvo',
    a2Kt: '_kolichestvo',
  },
  {
    subDt: '_subkontoDt3',
    subKt: '_subkontoKt3',
    a1Dt: '_istochnikFinansirovaniyaDt',
    a1Kt: '_istochnikFinansirovaniyaKt',
    a2Dt: '_kodPlatnykhUslugDt',
    a2Kt: '_kodPlatnykhUslugKt',
  },
]

/** Ссылочная ячейка → presentation; число → разряды; строка как есть; пусто → ''. */
export function resolveCellValue(v: unknown): string {
  if (v == null || v === '') return ''
  if (typeof v === 'object') {
    return (v as SduiCellObject).presentation ?? ''
  }
  if (typeof v === 'number') return formatWithSpaces(String(v))
  return String(v)
}

/** Сумма/количество: бэк шлёт "2000.0000" (toPlainString) → "2 000,00". */
export function formatSum(v: unknown): string {
  if (v == null || v === '') return ''
  const n = Number(v)
  const plain = Number.isFinite(n) ? n.toFixed(2) : String(v)
  return formatWithSpaces(plain)
}

/** binding → props.label по листьям TABLE_COLUMN (включая вложенные в COLUMN_GROUP). */
export function collectColumnLabels(tableNode: ViewNode): Map<string, string> {
  const map = new Map<string, string>()
  const visit = (n: ViewNode): void => {
    if (n.type === 'TABLE_COLUMN') {
      const binding = n.binding ?? (n.props?.binding as string | undefined) ?? n.id
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

const SUBKONTO_RE = /^_subkonto(?:Dt|Kt)(\d+)$/

/** Число строк блока: max(3, фактический max индекс субконто в данных). */
export function getBlockRowCount(rows: AccountingRow[]): number {
  let max = 3
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const m = SUBKONTO_RE.exec(key)
      if (m) max = Math.max(max, Number(m[1]))
    }
  }
  return max
}

/** Дефиниции строк блока: 1-3 из ROW_LAYOUT, дальше — только субконто. */
export function buildRowDefs(rowCount: number): BlockRowDef[] {
  return Array.from(
    { length: rowCount },
    (_, r) =>
      ROW_LAYOUT[r] ?? {
        subDt: `_subkontoDt${r + 1}`,
        subKt: `_subkontoKt${r + 1}`,
        a1Dt: '',
        a1Kt: '',
        a2Dt: '',
        a2Kt: '',
      },
  )
}
