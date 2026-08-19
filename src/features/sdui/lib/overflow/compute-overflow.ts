export interface OverflowItem {
  id: string
  width: number
  /** Никогда не сворачивается — props.pinned с бэка (SCRUM-362 B-5). */
  pinned: boolean
  /** Хозяин свёрнутого меню — props.overflowHost с бэка (SCRUM-362 B-5). */
  overflowHost: boolean
}

/**
 * Распределение кнопок командной панели по ширине (SCRUM-265 FE-5).
 * Возвращает id непиновых элементов, которые надо свернуть в «Ещё».
 * Сворачивание справа-налево (первыми уходят ближние к «Ещё»); pinned остаются.
 * `moreWidth` резервируется под кнопку «Ещё» (она уже учтена в pinned-сумме,
 * если присутствует в items; параметр — на случай, когда «Ещё» появляется
 * только при непустом overflow).
 */
export function computeOverflow(
  items: OverflowItem[],
  availableWidth: number,
  moreWidth: number
): string[] {
  const pinnedWidth = items
    .filter((i) => i.pinned)
    .reduce((sum, i) => sum + i.width, 0)
  const hasHostInItems = items.some((i) => i.overflowHost && i.pinned)
  const reserved = pinnedWidth + (hasHostInItems ? 0 : moreWidth)

  const collapsible = items.filter((i) => !i.pinned)
  const totalCollapsible = collapsible.reduce((sum, i) => sum + i.width, 0)

  if (reserved + totalCollapsible <= availableWidth) return []

  const budget = availableWidth - reserved
  const collapsed: string[] = []
  let visibleWidth = totalCollapsible

  // Сворачиваем с конца (справа-налево), пока видимые непиновые не влезут.
  for (let i = collapsible.length - 1; i >= 0 && visibleWidth > budget; i--) {
    collapsed.push(collapsible[i].id)
    visibleWidth -= collapsible[i].width
  }
  return collapsed
}
