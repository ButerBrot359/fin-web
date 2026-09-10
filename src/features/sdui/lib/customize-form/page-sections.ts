import type { ViewNode } from '../../types/view'
import type { NodeDecision } from './collect-customizable-nodes'
import { GRID_UNITS, zoneDecisions, type GridZone } from './grid-zones'
import {
  collectTableColumns,
  type TableColumnItem,
} from './collect-table-columns'

/**
 * Модель редактора v5 «страница секциями» (модель владельца 11.09): страница —
 * вертикальная стопка крупных блоков (шапка-зона, блок вкладок, итоги,
 * подвал-зона), блоки переставляются между собой и скрываются; внутри блока
 * вкладок вкладки скрываются галочками, полевые вкладки несут свою грид-зону,
 * табличные — список колонок.
 */
export interface TabInfo {
  nodeId: string
  title: string
  hidden: boolean
  zone?: GridZone
  tableColumns?: TableColumnItem[]
}

export interface PageSection {
  nodeId: string
  kind: 'zone' | 'tabs' | 'block'
  label: string
  /** Секцию можно скрыть целиком (block/tabs); зоны скрываются пополево. */
  hidable: boolean
  hidden: boolean
  zone?: GridZone
  tabs?: TabInfo[]
}

/**
 * Строит секции страницы: ищется контейнер-«тело» (среди прямых детей есть
 * нормализованная зона, TABS или TABLE), его дети — секции. Формы без такой
 * структуры отдают пустой список — диалог падает на легаси-режим.
 */
export function buildPageSections(
  root: ViewNode | null,
  zonesById: Map<string, GridZone>,
  hiddenByUser: ReadonlySet<string>,
  tableColumns: Map<string, TableColumnItem[]>
): PageSection[] {
  const body = root ? findBody(root) : null
  if (!body) return []
  const sections: PageSection[] = []
  for (const child of body.children ?? []) {
    const userHidden = hiddenByUser.has(child.id)
    const serverHidden = child.props?.visible === false && !userHidden
    if (serverHidden) continue
    const section = toSection(child, zonesById, hiddenByUser, tableColumns)
    if (section) {
      section.hidden = userHidden
      sections.push(section)
    }
  }
  return sections.length > 1 ? sections : []
}

function findBody(node: ViewNode): ViewNode | null {
  const children = node.children ?? []
  const hasSectionChild = children.some(
    (c) =>
      c.type === 'TABS' ||
      c.type === 'TABLE' ||
      (c.type === 'GRID' &&
        (c.props?.columns as number | undefined) === GRID_UNITS)
  )
  if (hasSectionChild) return node
  for (const child of children) {
    if (child.type === 'TOOLBAR') continue
    const found = findBody(child)
    if (found) return found
  }
  return null
}

function toSection(
  node: ViewNode,
  zonesById: Map<string, GridZone>,
  hiddenByUser: ReadonlySet<string>,
  tableColumns: Map<string, TableColumnItem[]>
): PageSection | null {
  const zone = zonesById.get(node.id)
  if (zone) {
    return {
      nodeId: node.id,
      kind: 'zone',
      label: zoneLabel(zone),
      hidable: false,
      hidden: false,
      zone,
    }
  }
  if (node.type === 'TABS') {
    const tabs: TabInfo[] = []
    for (const tab of node.children ?? []) {
      if (tab.type !== 'TAB') continue
      const userHidden = hiddenByUser.has(tab.id)
      if (tab.props?.visible === false && !userHidden) continue
      const tabZoneNode = (tab.children ?? []).find(
        (c) =>
          c.type === 'GRID' &&
          (c.props?.columns as number | undefined) === GRID_UNITS
      )
      const table = (tab.children ?? []).find((c) => c.type === 'TABLE')
      tabs.push({
        nodeId: tab.id,
        title:
          (tab.props?.title as string | undefined) ??
          (tab.props?.label as string | undefined) ??
          '⋯',
        hidden: userHidden,
        zone: tabZoneNode ? zonesById.get(tabZoneNode.id) : undefined,
        tableColumns: table ? tableColumns.get(table.id) : undefined,
      })
    }
    return {
      nodeId: node.id,
      kind: 'tabs',
      label: tabs.map((t) => t.title).join(' · '),
      hidable: true,
      hidden: false,
      tabs,
    }
  }
  // Прочие блоки (итоги-лейблы, одиночные таблицы, нераспознанные стеки):
  // плашка с возможностью скрыть и переставить.
  return {
    nodeId: node.id,
    kind: 'block',
    label: blockLabel(node),
    hidable: true,
    hidden: false,
  }
}

function zoneLabel(zone: GridZone): string {
  const labels = zone.rows.flat().map((i) => i.label)
  return labels.slice(0, 3).join(', ') + (labels.length > 3 ? '…' : '')
}

function blockLabel(node: ViewNode): string {
  const label = node.props?.label ?? node.props?.title
  if (typeof label === 'string' && label.trim() !== '') return label
  const texts: string[] = []
  collectLabels(node, texts)
  return texts.length > 0
    ? texts.slice(0, 3).join(', ') + (texts.length > 3 ? '…' : '')
    : '⋯'
}

function collectLabels(node: ViewNode, out: string[]): void {
  if (out.length > 3) return
  const label = node.props?.label
  if (typeof label === 'string' && label.trim() !== '') out.push(label)
  for (const child of node.children ?? []) collectLabels(child, out)
}

/**
 * Сериализация: секции получают сквозной order (перестановка блоков страницы),
 * скрытые block/tabs/вкладки — visible:false; зоны и колонки — свои решения.
 */
export function sectionDecisions(
  sections: PageSection[],
  decisions: Map<string, NodeDecision>
): void {
  sections.forEach((section, index) => {
    decisions.set(section.nodeId, {
      hidden: section.hidable ? section.hidden : false,
      order: index,
    })
    if (section.zone) zoneDecisions([section.zone], decisions)
    for (const tab of section.tabs ?? []) {
      decisions.set(tab.nodeId, { hidden: tab.hidden })
      if (tab.zone) zoneDecisions([tab.zone], decisions)
      for (const column of tab.tableColumns ?? []) {
        decisions.set(column.nodeId, { hidden: column.hidden })
      }
    }
  })
}

export { collectTableColumns }
