import type {
  AppearanceRule,
  ConditionalAppearance,
} from '@/entities/form-config'

export interface CellAppearance {
  text: string
  /** CSS-цвет текста (напр. "red"/"green"), как прислал бэк. */
  color?: string
}

const matchCondition = (
  operator: string,
  cellValue: unknown,
  target: unknown
): boolean => {
  const a = Number(cellValue)
  const b = Number(target)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  switch (operator) {
    case 'less':
      return a < b
    case 'greater':
      return a > b
    case 'equal':
      return a === b
    default:
      return false
  }
}

/**
 * Правила оформления для колонки ТЧ: запись, где `tableParts` включает эту ТЧ и
 * `column` совпадает с кодом колонки. Иначе undefined (оформления нет).
 */
export const findColumnAppearanceRules = (
  appearance: ConditionalAppearance[],
  tableCode: string,
  columnCode: string
): AppearanceRule[] | undefined =>
  appearance.find(
    (a) => a.tableParts.includes(tableCode) && a.column === columnCode
  )?.rules

/**
 * Первое подходящее правило `when` (по значению ячейки) → {text, color}. Если ни
 * одно не подошло — null (обычное отображение числа). В контракте `when.attribute`
 * = отображаемая колонка, поэтому сравниваем со значением самой ячейки.
 */
export const evaluateAppearance = (
  rules: AppearanceRule[] | undefined,
  cellValue: unknown
): CellAppearance | null => {
  if (!rules) return null
  for (const rule of rules) {
    if (matchCondition(rule.when.operator, cellValue, rule.when.value)) {
      return { text: rule.text, color: rule.textColor }
    }
  }
  return null
}
