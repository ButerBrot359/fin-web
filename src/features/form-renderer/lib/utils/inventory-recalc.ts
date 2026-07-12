import type { DocumentAttribute } from '@/entities/document-type'

/**
 * Колонки ТЧ инвентаризации ВНА для пересчёта излишков/недостач (зеркало 1С
 * ОсновныеСредстваПриИзменении / НематериальныеАктивыПриИзменении). Значения —
 * коды колонок этой ТЧ.
 */
export interface InventoryRecalcConfig {
  /** NalichiePoDannymUcheta (bool) */
  uchetCol: string
  /** NalichiePoFakticheskimDannym (bool) */
  faktCol: string
  /** StoimostPoDannymUcheta (число) */
  stoimUchetCol: string
  /** StoimostPoFakticheskimDannym (число) */
  stoimFaktCol: string
  /** IzlishkiNedostachaKolichestvo (целое) — результат */
  kolCol: string
  /** IzlishkiNedostachiStoimost (число) — результат */
  stoimResultCol: string
}

const eqOrEnds = (code: string, root: string): boolean => {
  const a = code.toLowerCase()
  const b = root.toLowerCase()
  return a === b || a.endsWith(b)
}

/**
 * Находит колонки инвентаризации ВНА. Возвращает null, если нет хотя бы одной
 * (тогда пересчёт не применяется — ТЧ не инвентаризационная).
 */
export const resolveInventoryRecalc = (
  columns: DocumentAttribute[]
): InventoryRecalcConfig | null => {
  const find = (root: string) =>
    columns.find((c) => eqOrEnds(c.code, root))?.code

  const uchetCol = find('NalichiePoDannymUcheta')
  const faktCol = find('NalichiePoFakticheskimDannym')
  const stoimUchetCol = find('StoimostPoDannymUcheta')
  const stoimFaktCol = find('StoimostPoFakticheskimDannym')
  const kolCol = find('IzlishkiNedostachaKolichestvo')
  const stoimResultCol = find('IzlishkiNedostachiStoimost')

  if (
    uchetCol &&
    faktCol &&
    stoimUchetCol &&
    stoimFaktCol &&
    kolCol &&
    stoimResultCol
  ) {
    return {
      uchetCol,
      faktCol,
      stoimUchetCol,
      stoimFaktCol,
      kolCol,
      stoimResultCol,
    }
  }
  return null
}

export interface InventoryResult {
  kol: number
  stoim: number
}

/**
 * kol = (НаличиеФакт ? 1 : 0) − (НаличиеУчёт ? 1 : 0);
 * если kol ≠ 0 → стоимость = (СтоимостьУчёт == 0) ? СтоимостьФакт : СтоимостьУчёт;
 * иначе стоимость = 0. Пустые/нечисловые стоимости трактуются как 0.
 */
export const computeInventory = (
  uchet: unknown,
  fakt: unknown,
  stoimUchet: unknown,
  stoimFakt: unknown
): InventoryResult => {
  const kol = (fakt ? 1 : 0) - (uchet ? 1 : 0)
  const su = Number(stoimUchet) || 0
  const sf = Number(stoimFakt) || 0
  const stoim = kol !== 0 ? (su === 0 ? sf : su) : 0
  return { kol, stoim }
}
