import type { ViewNode } from '../../types/view'
import type { NodeDecision } from './collect-customizable-nodes'

/**
 * Модель редактора грид-зон «Изменить форму» v4 (спека 2026-09-11):
 * зона — GRID-нода с провода (шапка, полевые вкладки), внутри — ЯВНЫЕ строки
 * (модель редактора; на проводе строки выражаются order+newRow). Спейсеры
 * конвертации в редактор не попадают: пользователь строит свой поток без дыр.
 */
export interface GridItem {
  nodeId: string
  label: string
  span: number
  hidden: boolean
}

export interface GridZone {
  zoneId: string
  /** Подпись зоны: заголовок вкладки; для шапки — пусто. */
  title: string
  rows: GridItem[][]
}

export const GRID_UNITS = 24

/**
 * Извлекает грид-зоны формы: шапка + полевые вкладки (по заголовку TAB).
 * `hiddenByUser` — ноды, скрытые ПАТЧЕМ пользователя: они остаются в модели
 * (пунктиром, на своих местах, их можно вернуть); скрытые сервером — нет.
 */
export function extractGridZones(
  root: ViewNode | null,
  hiddenByUser: ReadonlySet<string>
): GridZone[] {
  if (!root) return []
  const zones: GridZone[] = []
  walk(root, '', zones, hiddenByUser)
  return zones
}

function walk(
  node: ViewNode,
  tabTitle: string,
  zones: GridZone[],
  hiddenByUser: ReadonlySet<string>
): void {
  if (node.type === 'GRID') {
    zones.push(toZone(node, tabTitle, hiddenByUser))
    return
  }
  for (const child of node.children ?? []) {
    const title =
      node.type === 'TAB'
        ? ((node.props?.title as string | undefined) ??
          (node.props?.label as string | undefined) ??
          tabTitle)
        : tabTitle
    walk(child, node.type === 'TAB' ? title : tabTitle, zones, hiddenByUser)
  }
}

function toZone(
  grid: ViewNode,
  title: string,
  hiddenByUser: ReadonlySet<string>
): GridZone {
  const rows: GridItem[][] = []
  let current: GridItem[] = []
  let used = 0
  for (const child of grid.children ?? []) {
    const props = child.props ?? {}
    const userHidden = hiddenByUser.has(child.id)
    const serverHidden = props.visible === false && !userHidden
    if (child.type === 'SPACER' || serverHidden) {
      // Спейсер — дыра исходной раскладки: в модели редактора она выражается
      // границей строки. Скрытые СЕРВЕРОМ ноды не редактируются вовсе.
      if (child.type === 'SPACER') used += spanOf(props)
      continue
    }
    const span = spanOf(props)
    const newRow = props.newRow === true
    if (newRow || used + span > GRID_UNITS) {
      if (current.length > 0) rows.push(current)
      current = []
      used = 0
    }
    current.push({
      nodeId: child.id,
      label: (props.label as string | undefined) ?? child.id,
      span,
      hidden: userHidden,
    })
    used += span
  }
  if (current.length > 0) rows.push(current)
  return { zoneId: grid.id, title, rows }
}

function spanOf(props: Record<string, unknown>): number {
  const raw = props.colSpan
  if (typeof raw !== 'number' || raw < 1) return GRID_UNITS
  return Math.min(GRID_UNITS, Math.round(raw))
}

/** Свободные единицы в строке (для ограничения растягивания). */
export function rowFreeUnits(row: GridItem[]): number {
  return GRID_UNITS - row.reduce((sum, item) => sum + item.span, 0)
}

/**
 * Сериализация решений редактора: каждый элемент зоны получает order по
 * сквозному потоку, colSpan и newRow (true — только у первых элементов
 * НЕпервых строк; false кодируется отсутствием пропа).
 */
export function zoneDecisions(
  zones: GridZone[],
  decisions: Map<string, NodeDecision>
): void {
  for (const zone of zones) {
    let order = 0
    zone.rows.forEach((row, rowIndex) => {
      row.forEach((item, itemIndex) => {
        // newRow ВСЕГДА явный: undefined означал бы «не трогать», и базовый
        // newRow нормализатора пережил бы перестановку (живой дефект 11.09 —
        // элементы не вставали в одну строку).
        decisions.set(item.nodeId, {
          hidden: item.hidden,
          colSpan: item.span,
          newRow: rowIndex > 0 && itemIndex === 0,
          order: order++,
        })
      })
    })
  }
}

/** Глубокая копия зон — состояние редактора мутируется свободно. */
export function cloneZones(zones: GridZone[]): GridZone[] {
  return zones.map((zone) => ({
    ...zone,
    rows: zone.rows.map((row) => row.map((item) => ({ ...item }))),
  }))
}

/** Убирает пустые строки после перестановок. */
export function dropEmptyRows(zone: GridZone): void {
  zone.rows = zone.rows.filter((row) => row.length > 0)
}
