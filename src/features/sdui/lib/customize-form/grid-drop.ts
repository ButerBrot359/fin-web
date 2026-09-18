import {
  cloneZones,
  dropEmptyRows,
  reflowZone,
  type GridItem,
  type GridZone,
} from './grid-zones'

/** Цель броска внутри зон одного редактора (индексная адресация). */
export interface GridDropTarget {
  zoneIndex: number
  /** Индекс строки; вставка НОВОЙ строкой кодируется rowIndex с newRow=true. */
  rowIndex: number
  itemIndex: number
  newRow: boolean
}

/**
 * Цель броска элемента ЧУЖОЙ зоны (перенос между блоками, словарь v3):
 * редактор знает только свои зоны — перестановку между секциями делает диалог,
 * адресация здесь по id зоны, а не по индексу.
 */
export interface ExternalDropTarget {
  zoneId: string
  rowIndex: number
  itemIndex: number
  newRow: boolean
}

/** Ищет элемент по id среди зон; отдаёт зону и строку, в которых он лежит. */
export function findGridItem(
  list: GridZone[],
  nodeId: string
): { zone: GridZone; row: GridItem[]; item: GridItem } | null {
  for (const zone of list) {
    for (const row of zone.rows) {
      const item = row.find((i) => i.nodeId === nodeId)
      if (item) return { zone, row, item }
    }
  }
  return null
}

/**
 * Бросок внутри своих зон: вырезать перетаскиваемый элемент, вставить по цели
 * (новой строкой или в существующую с перетеканием переполнения). Чистая
 * функция — возвращает НОВЫЕ зоны (глубокая копия), исходные не трогает;
 * пустые строки после перестановки убираются.
 */
export function applyGridDrop(
  zones: GridZone[],
  draggedNodeId: string,
  target: GridDropTarget
): GridZone[] {
  const next = cloneZones(zones)
  moveDragged(next, draggedNodeId, target)
  next.forEach(dropEmptyRows)
  return next
}

function moveDragged(
  next: GridZone[],
  draggedNodeId: string,
  target: GridDropTarget
): void {
  const source = findGridItem(next, draggedNodeId)
  if (!source) return
  const zone = next[target.zoneIndex]
  const sourceItemIndex = source.row.indexOf(source.item)
  source.row.splice(sourceItemIndex, 1)
  if (target.newRow) {
    // Индекс строки-цели фиксировался ДО удаления: опустевшая строка
    // источника выше цели сдвигает нумерацию на единицу.
    let rowIndex = target.rowIndex
    if (source.row.length === 0) {
      const emptyIndex = zone.rows.indexOf(source.row)
      if (emptyIndex >= 0 && emptyIndex < rowIndex) rowIndex--
      zone.rows.splice(emptyIndex, 1)
    }
    zone.rows.splice(rowIndex, 0, [source.item])
  } else {
    const row = zone.rows[target.rowIndex] as GridItem[] | undefined
    if (!row) return
    let index = target.itemIndex
    // Перестановка внутри своей строки: удаление источника сместило цель.
    if (row === source.row && sourceItemIndex < index) index--
    // Вставка БЕЗ ужатия: переполненная строка перетекает на следующую
    // (reflowZone), как текст — интуиция «подвинься» вместо запрета.
    row.splice(Math.min(index, row.length), 0, source.item)
    reflowZone(zone, source.item.nodeId)
  }
}
