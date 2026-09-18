import type { ViewSettingsPatchEntry } from '../../api/view-settings-api'
import {
  assignOrders,
  buildPatchFromDecisions,
  type CustomizableNode,
  type NodeDecision,
} from './collect-customizable-nodes'
import { sectionDecisions, type PageSection } from './page-sections'

interface BuildSettingsPatchArgs {
  sections: PageSection[]
  /** Исходный и текущий порядок легаси-строк (форма без секций). */
  originalRows: CustomizableNode[]
  rows: CustomizableNode[]
  hidden: ReadonlySet<string>
  widths: ReadonlyMap<string, number | undefined>
  /** Переопределения подписей (Ф5): '' — снять; отсутствие ключа — не трогали. */
  labels: ReadonlyMap<string, string>
  patch: ViewSettingsPatchEntry[] | undefined
}

/**
 * Полный патч настроек из состояния редактора: решения секций v5 либо
 * легаси-строк (видимость/ширина/порядок), поверх — переопределения подписей,
 * не стирая прочие пропы текущего патча.
 */
export function buildSettingsPatch({
  sections,
  originalRows,
  rows,
  hidden,
  widths,
  labels,
  patch,
}: BuildSettingsPatchArgs): ViewSettingsPatchEntry[] {
  const decisions = new Map<string, NodeDecision>()
  if (sections.length > 0) {
    sectionDecisions(sections, decisions)
  } else {
    for (const row of rows) {
      decisions.set(row.nodeId, {
        hidden: hidden.has(row.nodeId),
        width: widths.get(row.nodeId),
      })
    }
    assignOrders(originalRows, rows, decisions)
  }
  for (const [nodeId, label] of labels) {
    const decision = decisions.get(nodeId) ?? { hidden: false }
    const trimmed = label.trim()
    const hadBefore = (patch ?? []).some(
      (e) => e.nodeId === nodeId && typeof e.props.label === 'string'
    )
    if (trimmed !== '') decision.label = trimmed
    else if (hadBefore) decision.label = null
    decisions.set(nodeId, decision)
  }
  return buildPatchFromDecisions(patch ?? [], decisions)
}
