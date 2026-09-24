import type {
  MenuPatchEntry,
  MenuSettingsPatch,
  MenuStructure,
} from '../../api/menu-settings-api'

/**
 * Состояние редактора меню (SCRUM-426): черновик поверх структуры слоя.
 * Чистые иммутабельные функции — вся логика тумблеров/перестановок и обратная
 * сборка патча живут здесь, компоненты только рендерят.
 *
 * Родительские ключи: '' — модули, ключ модуля — его секции, ключ секции — её ссылки.
 */
export interface MenuDraft {
  /** Ключи, скрытые В ЭТОМ слое (hidden: true). */
  hidden: Set<string>
  /** Ключи с явным hidden: false — показать поверх нижних слоёв. */
  revealed: Set<string>
  /** parentKey → упорядоченные ключи детей (все родители структуры). */
  orderByParent: Map<string, string[]>
}

interface ParentChildren {
  parentKey: string
  childKeys: string[]
}

/** Все родительские списки структуры в базовом порядке. */
const parentsOf = (structure: MenuStructure): ParentChildren[] => {
  const parents: ParentChildren[] = [
    { parentKey: '', childKeys: structure.modules.map((m) => m.key) },
  ]
  for (const module of structure.modules) {
    parents.push({
      parentKey: module.key,
      childKeys: module.sections.map((s) => s.key),
    })
    for (const section of module.sections) {
      parents.push({
        parentKey: section.key,
        childKeys: section.elements.map((e) => e.key),
      })
    }
  }
  return parents
}

/** order пункта в патче слоя; отсутствие записи — undefined. */
const patchOrderOf = (
  patch: MenuSettingsPatch,
  key: string
): number | undefined => (key in patch ? patch[key].order : undefined)

/** Порядок слоя: дети с order из патча — первыми по возрастанию, прочие — следом как в базе. */
const orderedByPatch = (
  childKeys: string[],
  patch: MenuSettingsPatch
): string[] => {
  const withOrder = childKeys
    .filter((key) => patchOrderOf(patch, key) != null)
    .sort(
      (a, b) => (patchOrderOf(patch, a) ?? 0) - (patchOrderOf(patch, b) ?? 0)
    )
  const rest = childKeys.filter((key) => patchOrderOf(patch, key) == null)
  return [...withOrder, ...rest]
}

export function seedDraft(structure: MenuStructure): MenuDraft {
  const hidden = new Set<string>()
  const revealed = new Set<string>()
  for (const [key, entry] of Object.entries(structure.patch)) {
    if (entry.hidden === true) hidden.add(key)
    if (entry.hidden === false) revealed.add(key)
  }
  const orderByParent = new Map<string, string[]>()
  for (const { parentKey, childKeys } of parentsOf(structure)) {
    orderByParent.set(parentKey, orderedByPatch(childKeys, structure.patch))
  }
  return { hidden, revealed, orderByParent }
}

/**
 * Цикл тумблера видимости: скрыт в слое → снять; иначе — если пункт скрыт нижними
 * слоями, первый клик означает «показать» (hidden: false), иначе — «скрыть».
 */
export function toggleHidden(
  draft: MenuDraft,
  key: string,
  effectiveHiddenBelow: boolean
): MenuDraft {
  const hidden = new Set(draft.hidden)
  const revealed = new Set(draft.revealed)
  if (hidden.has(key)) {
    hidden.delete(key)
    if (effectiveHiddenBelow) revealed.add(key)
  } else if (revealed.has(key)) {
    revealed.delete(key)
  } else if (effectiveHiddenBelow) {
    revealed.add(key)
  } else {
    hidden.add(key)
  }
  return { hidden, revealed, orderByParent: draft.orderByParent }
}

/** Сдвиг пункта среди соседей; выход за край — без изменений. */
export function moveItem(
  draft: MenuDraft,
  parentKey: string,
  key: string,
  dir: -1 | 1
): MenuDraft {
  const siblings = draft.orderByParent.get(parentKey)
  if (!siblings) return draft
  const index = siblings.indexOf(key)
  const target = index + dir
  if (index < 0 || target < 0 || target >= siblings.length) return draft
  const next = [...siblings]
  next[index] = next[target]
  next[target] = key
  const orderByParent = new Map(draft.orderByParent)
  orderByParent.set(parentKey, next)
  return { hidden: draft.hidden, revealed: draft.revealed, orderByParent }
}

/**
 * Обратная сборка патча слоя: hidden из тумблеров; order — полной перестановкой детей
 * родителя, если их порядок отличается от базового, иначе существующие order слоя
 * сохраняются как были.
 */
export function buildPatch(
  structure: MenuStructure,
  draft: MenuDraft
): MenuSettingsPatch {
  const patch: MenuSettingsPatch = {}
  const upsert = (key: string, entry: MenuPatchEntry): void => {
    patch[key] = { ...patch[key], ...entry }
  }
  for (const key of draft.hidden) upsert(key, { hidden: true })
  for (const key of draft.revealed) upsert(key, { hidden: false })

  for (const { parentKey, childKeys } of parentsOf(structure)) {
    const draftOrder = draft.orderByParent.get(parentKey) ?? childKeys
    const unchanged =
      draftOrder.length === childKeys.length &&
      draftOrder.every((key, i) => key === childKeys[i])
    if (unchanged) {
      for (const key of childKeys) {
        const existing = patchOrderOf(structure.patch, key)
        if (existing != null) upsert(key, { order: existing })
      }
    } else {
      draftOrder.forEach((key, index) => {
        upsert(key, { order: index })
      })
    }
  }
  return patch
}
