import type { CustomizableNode } from './collect-customizable-nodes'

/**
 * Чистые операции легаси-режима «Изменить форму» (форма без секций): плоский
 * список строк, порядок меняется только среди соседей одного родителя.
 */

/** Переключение галочки видимости строки. */
export function toggleRowHidden(
  hidden: ReadonlySet<string>,
  nodeId: string
): Set<string> {
  const next = new Set(hidden)
  if (next.has(nodeId)) next.delete(nodeId)
  else next.add(nodeId)
  return next
}

/**
 * Перестановка с соседом ТОЙ ЖЕ группы; нет соседа в эту сторону — исходный
 * массив возвращается как есть (без ре-рендера).
 */
export function moveRow(
  rows: CustomizableNode[],
  nodeId: string,
  direction: -1 | 1
): CustomizableNode[] {
  const index = rows.findIndex((r) => r.nodeId === nodeId)
  if (index < 0) return rows
  const parentId = rows[index].parentId
  let neighbor = index + direction
  while (
    neighbor >= 0 &&
    neighbor < rows.length &&
    rows[neighbor].parentId !== parentId
  ) {
    neighbor += direction
  }
  if (neighbor < 0 || neighbor >= rows.length) return rows
  const next = [...rows]
  ;[next[index], next[neighbor]] = [next[neighbor], next[index]]
  return next
}

/** Есть ли у строки соседи своей группы выше/ниже (доступность стрелок). */
export function siblingBounds(
  rows: CustomizableNode[],
  row: CustomizableNode | null,
  index: number
): { canMoveUp: boolean; canMoveDown: boolean } {
  return {
    canMoveUp:
      row != null &&
      rows.slice(0, index).some((r) => r.parentId === row.parentId),
    canMoveDown:
      row != null &&
      rows.slice(index + 1).some((r) => r.parentId === row.parentId),
  }
}
