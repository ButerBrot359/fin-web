import type { ValidationTarget } from '@/entities/validation-report'

import type { ViewNode } from '../../types/view'

/**
 * Вид цели для сужения поиска (SCRUM-317 v4 §4.5). Выводится из типа
 * контракта, не дублируется строковым юнионом: новый вид цели на бэке
 * подсветится компилятором. null — вид неизвестен (легаси-канал по
 * attributeCode), поиск ведётся как раньше, по одному binding.
 */
export type RevealKind = ValidationTarget['kind'] | null

/**
 * Узел удовлетворяет виду цели: поле шапки НЕ удовлетворяется колонкой ТЧ с
 * тем же кодом (коллизия FizicheskoeLitso у «Отпуска» — поле шапки и колонка
 * в четырёх ТЧ), адрес таблицы/ячейки находит узел TABLE.
 */
function matchesKind(node: ViewNode, kind: RevealKind): boolean {
  if (kind === 'FIELD') return node.type !== 'TABLE_COLUMN'
  if (kind === 'TABLE' || kind === 'TABLE_CELL') return node.type === 'TABLE'
  return true
}

/**
 * Есть ли в поддереве узел с данным binding, удовлетворяющий виду цели
 * (адрес TABLE_CELL несёт columnCode, но искать вкладку достаточно по
 * tableCode, а FIELD — по коду реквизита).
 */
export function subtreeHasBinding(
  node: ViewNode,
  binding: string,
  kind: RevealKind = null
): boolean {
  if (node.binding === binding && matchesKind(node, kind)) return true
  if (!node.children) return false
  return node.children.some((child) => subtreeHasBinding(child, binding, kind))
}
