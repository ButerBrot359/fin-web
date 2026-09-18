import type { ViewNode } from '../../types/view'
import type { ViewSettingsPatchEntry } from '../../api/view-settings-api'
import {
  collectCustomizableNodes,
  type CustomizableNode,
} from './collect-customizable-nodes'
import { extractGridZones } from './grid-zones'
import {
  buildPageSections,
  collectTableColumns,
  type PageSection,
} from './page-sections'

/** Начальное состояние редактора «Изменить форму», посеянное из патча. */
export interface EditorSeed {
  sections: PageSection[]
  /** Легаси-строки (форма без секций); при секциях — пусто. */
  rows: CustomizableNode[]
  hidden: Set<string>
  widths: Map<string, number | undefined>
  /** Переопределения подписей из патча (Ф5). */
  labels: Map<string, string>
}

/**
 * Чистый посев состояния редактора: «патч + дерево → начальное состояние».
 * Секционная форма даёт секции v5 (легаси-структуры пустые), форма без
 * секций — плоские строки с галочками/ширинами; подписи — из патча в обоих
 * режимах.
 */
export function seedEditorState(
  root: ViewNode | null,
  patch: ViewSettingsPatchEntry[]
): EditorSeed {
  const hiddenByUser = new Set(
    patch.filter((e) => e.props.visible === false).map((e) => e.nodeId)
  )
  const zones = extractGridZones(root, hiddenByUser)
  const zonesById = new Map(zones.map((z) => [z.zoneId, z]))
  const tableColumns = collectTableColumns(root, hiddenByUser)
  const sections = buildPageSections(
    root,
    zonesById,
    hiddenByUser,
    tableColumns
  )
  const rows =
    sections.length === 0 ? collectCustomizableNodes(root, patch) : []
  return {
    sections,
    rows,
    hidden: new Set(rows.filter((n) => !n.visible).map((n) => n.nodeId)),
    widths: new Map(rows.map((n) => [n.nodeId, n.width])),
    labels: new Map(
      patch
        .filter((e) => typeof e.props.label === 'string')
        .map((e) => [e.nodeId, e.props.label as string])
    ),
  }
}
