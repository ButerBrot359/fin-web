import {
  dropEmptyRows,
  reflowZone,
  type GridItem,
  type GridZone,
} from './grid-zones'
import type { PageSection } from './page-sections'
import type { ExternalDropTarget } from './grid-drop'

/**
 * Чистые мутации секций страницы (редактор v5): каждая функция получает
 * текущие секции, возвращает НОВЫЙ массив (глубокая копия), исходный не
 * трогает — состояние диалога обновляется простым setState.
 */

/** Глубокая копия секций — правки не задевают состояние React. */
export function cloneSections(sections: PageSection[]): PageSection[] {
  return sections.map((s) => ({
    ...s,
    zone: s.zone
      ? {
          ...s.zone,
          rows: s.zone.rows.map((r) => r.map((i) => ({ ...i }))),
        }
      : undefined,
    tabs: s.tabs?.map((tab) => ({
      ...tab,
      zone: tab.zone
        ? {
            ...tab.zone,
            rows: tab.zone.rows.map((r) => r.map((i) => ({ ...i }))),
          }
        : undefined,
      tableColumns: tab.tableColumns?.map((c) => ({ ...c })),
    })),
  }))
}

/** Перестановка секции с вертикальным соседом; выход за края — без изменений. */
export function moveSection(
  sections: PageSection[],
  index: number,
  direction: -1 | 1
): PageSection[] {
  const next = cloneSections(sections)
  const target = index + direction
  if (target < 0 || target >= next.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Замена зоны по id (результат DnD-редактора) — в секции или её вкладке. */
export function replaceZone(
  sections: PageSection[],
  zoneId: string,
  zone: GridZone
): PageSection[] {
  const next = cloneSections(sections)
  for (const section of next) {
    if (section.zone?.zoneId === zoneId) section.zone = zone
    for (const tab of section.tabs ?? []) {
      if (tab.zone?.zoneId === zoneId) tab.zone = zone
    }
  }
  return next
}

/**
 * Перенос элемента МЕЖДУ зонами (словарь v3): вырезать из исходной строки,
 * вставить в целевую зону по координатам броска; ширина сохраняется,
 * переполнение целевой строки перетекает как обычно.
 */
export function moveAcrossZones(
  sections: PageSection[],
  nodeId: string,
  target: ExternalDropTarget
): PageSection[] {
  const next = cloneSections(sections)
  const zones = next.flatMap((section) => [
    ...(section.zone ? [section.zone] : []),
    ...(section.tabs?.flatMap((tab) => (tab.zone ? [tab.zone] : [])) ?? []),
  ])
  let item: GridItem | null = null
  for (const zone of zones) {
    for (const row of zone.rows) {
      const index = row.findIndex((i) => i.nodeId === nodeId)
      if (index >= 0) {
        item = row.splice(index, 1)[0]
        dropEmptyRows(zone)
        break
      }
    }
    if (item) break
  }
  const to = zones.find((zone) => zone.zoneId === target.zoneId)
  if (!item || !to) return next
  if (target.newRow) {
    to.rows.splice(Math.min(target.rowIndex, to.rows.length), 0, [item])
  } else {
    const row = to.rows[target.rowIndex] as GridItem[] | undefined
    if (row) row.splice(Math.min(target.itemIndex, row.length), 0, item)
    else to.rows.push([item])
    reflowZone(to, item.nodeId)
  }
  return next
}

/** Переключение видимости элемента зоны (галочка панели выбранного). */
export function toggleZoneItem(
  sections: PageSection[],
  nodeId: string
): PageSection[] {
  const next = cloneSections(sections)
  for (const section of next) {
    const zones = [
      section.zone,
      ...(section.tabs?.map((tab) => tab.zone) ?? []),
    ]
    for (const zone of zones) {
      for (const row of zone?.rows ?? []) {
        const item = row.find((i) => i.nodeId === nodeId)
        if (item) item.hidden = !item.hidden
      }
    }
  }
  return next
}

/** Переключение видимости секции целиком. */
export function toggleSection(
  sections: PageSection[],
  index: number
): PageSection[] {
  const next = cloneSections(sections)
  next[index].hidden = !next[index].hidden
  return next
}

/** Переключение видимости вкладки внутри секции. */
export function toggleTab(
  sections: PageSection[],
  index: number,
  tabId: string
): PageSection[] {
  const next = cloneSections(sections)
  const tab = next[index].tabs?.find((x) => x.nodeId === tabId)
  if (tab) tab.hidden = !tab.hidden
  return next
}

/** Переключение видимости колонки табличной вкладки. */
export function toggleTabColumn(
  sections: PageSection[],
  index: number,
  tabId: string,
  columnId: string
): PageSection[] {
  const next = cloneSections(sections)
  const tab = next[index].tabs?.find((x) => x.nodeId === tabId)
  const column = tab?.tableColumns?.find((c) => c.nodeId === columnId)
  if (column) column.hidden = !column.hidden
  return next
}
