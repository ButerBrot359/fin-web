import type { MovementGroup } from '../api/document-movements-api'

/** Ссылочное значение измерения с бэка (подразделение и т.п.). */
type RefLike = { id?: number | string; displayName?: string; nameRu?: string }

/**
 * Кредитные значения измерений проводки, выведенные из НАКОПИТЕЛЬНОГО регистра
 * того же ответа `/movements`. В accounting-группе REST измерение приходит одним
 * полем (= дебетовая сторона), поэтому кредит (расход) достаём из
 * ACCUMULATION-групп по `_movementKind === 'Расход'`.
 *
 * Значение возвращаем ТОЛЬКО когда оно однозначно (ровно одно на всю выборку) —
 * иначе (несколько разных подразделений в расходе) сработает штатный фолбэк, а
 * не потенциально неверная подстановка.
 *
 * Ключи результата совпадают с `*Label`-кодами accounting-грида: сейчас
 * поддержано «Подразделение» (накопит. `PodrazdelenieOrganizatsii` →
 * `Podrazdelenie`).
 */
export const deriveCreditDimensions = (
  groups: MovementGroup[]
): Record<string, unknown> => {
  const singleRashodValue = (field: string): unknown => {
    const seen = new Map<string, unknown>()
    for (const group of groups) {
      if (group.registerKind !== 'ACCUMULATION') continue
      for (const entry of group.entries) {
        if (entry._movementKind !== 'Расход') continue
        const value = entry[field]
        if (value && typeof value === 'object') {
          const ref = value as RefLike
          const key = String(ref.id ?? ref.displayName ?? ref.nameRu ?? '')
          if (key) seen.set(key, value)
        }
      }
    }
    return seen.size === 1 ? [...seen.values()][0] : undefined
  }

  const overrides: Record<string, unknown> = {}
  const creditPodrazdelenie = singleRashodValue('PodrazdelenieOrganizatsii')
  if (creditPodrazdelenie !== undefined) {
    overrides.Podrazdelenie = creditPodrazdelenie
  }
  return overrides
}
