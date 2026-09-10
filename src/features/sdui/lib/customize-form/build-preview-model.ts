import type { ViewNode } from '../../types/view'
import { FIELD_NODE_TYPES } from '../utils/field-node-types'
import type { CustomizableNode } from './collect-customizable-nodes'

/**
 * Модель живого превью «Изменить форму» (решение владельца 11.09): схема
 * РЕАЛЬНОЙ сетки формы — строки/колонки как в дереве с провода, поля и
 * таблицы плашками. Пользователь видит, что куда встанет, ещё до сохранения.
 */
export interface PreviewNode {
  nodeId: string
  kind: 'row' | 'column' | 'leaf' | 'tabs'
  /** Подпись плашки (для leaf/tabs); контейнеры подписи не рисуют. */
  label?: string
  /** Плашку можно выбрать и настроить (есть в списке editable-нод). */
  editable: boolean
  /** Таблица/вкладки — широкая плашка на всю строку. */
  wide: boolean
  children: PreviewNode[]
}

const ROW_TYPES = new Set(['HSTACK', 'GRID'])
const COLUMN_TYPES = new Set(['VSTACK', 'GROUP', 'PAGE'])
/** Служебный хром, который в превью не нужен: команды и поиск — не раскладка. */
const SKIPPED_TYPES = new Set(['TOOLBAR', 'BUTTON', 'MENU_ITEM', 'SEPARATOR'])

/**
 * Строит модель превью. Порядок editable-детей внутри группы задаёт
 * `arrangedRows` (состояние диалога) — превью живое: стрелки/скрытие видны
 * сразу. Ноды, скрытые сервером (не пользователем), в превью не попадают.
 */
export function buildPreviewModel(
  root: ViewNode | null,
  arrangedRows: CustomizableNode[]
): PreviewNode | null {
  if (!root) return null
  const editableIds = new Set(arrangedRows.map((r) => r.nodeId))
  const orderIndex = new Map(arrangedRows.map((r, i) => [r.nodeId, i]))
  const hiddenByUser = new Set(
    arrangedRows.filter((r) => r.hiddenByUser).map((r) => r.nodeId)
  )

  const build = (node: ViewNode): PreviewNode | null => {
    if (SKIPPED_TYPES.has(node.type)) return null
    const serverHidden =
      node.props?.visible === false && !hiddenByUser.has(node.id)
    if (serverHidden && !editableIds.has(node.id)) return null

    if (node.type === 'TABS') {
      return {
        nodeId: node.id,
        kind: 'tabs',
        // У TAB подпись живёт в title (label — фолбэк), как в tabs-node.
        label: (node.children ?? [])
          .map(
            (tab) =>
              (tab.props?.title as string | undefined) ??
              (tab.props?.label as string | undefined)
          )
          .filter(Boolean)
          .join(' · '),
        editable: false,
        wide: true,
        children: [],
      }
    }

    const label = node.props?.label as string | undefined
    if (FIELD_NODE_TYPES.has(node.type) || node.type === 'TABLE') {
      if (typeof label !== 'string' || label.trim() === '') return null
      return {
        nodeId: node.id,
        kind: 'leaf',
        label,
        editable: editableIds.has(node.id),
        wide: node.type === 'TABLE',
        children: [],
      }
    }

    if (ROW_TYPES.has(node.type) || COLUMN_TYPES.has(node.type)) {
      const children = (node.children ?? [])
        .map(build)
        .filter((child): child is PreviewNode => child !== null)
      // Живой порядок: editable-дети группы идут в порядке состояния диалога,
      // остальные держат свои места (те же «слоты», что и applier на бэке).
      const slots = children
        .map((_, i) => i)
        .filter((i) => editableIds.has(children[i].nodeId))
      const editableSorted = slots
        .map((i) => children[i])
        .sort(
          (a, b) =>
            (orderIndex.get(a.nodeId) ?? 0) - (orderIndex.get(b.nodeId) ?? 0)
        )
      slots.forEach((slot, j) => {
        children[slot] = editableSorted[j]
      })
      if (children.length === 0) return null
      return {
        nodeId: node.id,
        kind: ROW_TYPES.has(node.type) ? 'row' : 'column',
        editable: false,
        wide: false,
        children,
      }
    }

    return null
  }

  return build(root)
}
