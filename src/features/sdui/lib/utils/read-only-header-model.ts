// Модель колонок и двухрядной шапки read-only таблицы (таблицы движений и др.).
// Вынесено из ui/nodes/composite/table-node.tsx: рендер read-only таблицы уехал
// в собственный файл (read-only-table.tsx), а чистая модель осталась в lib —
// она тестируется без DOM. Логика перенесена verbatim, кроме ширин колонок
// (width/minWidth/resizable), добавленных для ресайза.

import type { ViewNode } from '../../types/view'
import { nodeToTableColumnDef } from './build-column-defs'
import { isNodeVisible } from './column-visibility'
import { columnBackground, columnTextColor } from './column-background'

export interface ReadOnlyColumnDef {
  id: string
  label: string
  binding?: string
  flex?: number | string
  /** Начальная ширина с бэка (props.width). */
  width?: number
  /** Пол при перетаскивании (props.minWidth), приходит редко. */
  minWidth?: number
  /** props.resizable; бэк эмитит только false. */
  resizable?: boolean
  /** Постоянная заливка ячеек колонки (props.backgroundColor). */
  backgroundColor?: string
  /** Постоянный цвет текста ячеек колонки (props.textColor). */
  textColor?: string
}

/**
 * Рекурсивно собирает ВИДИМЫЕ листовые TABLE_COLUMN (включая вложенные в
 * COLUMN_GROUP) в порядке документа. Скрытая колонка и скрытая группа целиком
 * выпадают: read-only таблица только показывает данные, ключи связи ей не нужны
 * (см. column-visibility).
 */
function collectLeafColumns(node: ViewNode): ViewNode[] {
  if (!isNodeVisible(node)) return []
  if (node.type === 'TABLE_COLUMN') return [node]
  if (node.type === 'COLUMN_GROUP')
    return (node.children ?? []).flatMap(collectLeafColumns)
  return []
}

export function extractReadOnlyColumns(
  children: ViewNode[] | undefined
): ReadOnlyColumnDef[] {
  if (!children) return []
  return children.flatMap(collectLeafColumns).map((c) => {
    const col = nodeToTableColumnDef(c)
    return {
      id: col.id,
      label: col.label,
      binding: col.binding,
      flex: col.flex,
      width: col.width,
      minWidth: col.minWidth,
      resizable: col.resizable,
      backgroundColor: columnBackground(col.props),
      textColor: columnTextColor(col.props),
    }
  })
}

export interface HeaderCell {
  id: string
  label: string
  colSpan?: number
  rowSpan?: number
  align?: 'center'
}

export interface HeaderModel {
  hasGroups: boolean
  topRow: HeaderCell[]
  bottomRow: HeaderCell[]
}

/**
 * Модель двухрядной шапки read-only таблицы.
 * COLUMN_GROUP → ячейка верхнего ряда (colSpan = число листьев), листья → нижний ряд.
 * Плоский TABLE_COLUMN при наличии групп → rowSpan=2.
 * Без групп colSpan/rowSpan не проставляются — DOM идентичен прежнему рендеру.
 * Пустые COLUMN_GROUP пропускаются (colSpan: 0 невалиден).
 */
export function buildHeaderModel(
  children: ViewNode[] | undefined
): HeaderModel {
  const nodes = children ?? []

  // First pass: check if there are any non-empty groups
  const hasNonEmptyGroups = nodes.some((node) => {
    if (node.type === 'COLUMN_GROUP') {
      return collectLeafColumns(node).length > 0
    }
    return false
  })

  const topRow: HeaderCell[] = []
  const bottomRow: HeaderCell[] = []

  // Second pass: build rows
  for (const node of nodes) {
    // Скрытая колонка/группа не попадает в шапку (§111/§273). Для групп этого
    // мало: у видимой группы могут быть скрытые листья, поэтому colSpan ниже
    // считается по отфильтрованным листьям collectLeafColumns.
    if (!isNodeVisible(node)) continue
    if (node.type === 'TABLE_COLUMN') {
      const col = nodeToTableColumnDef(node)
      topRow.push({
        id: col.id,
        label: col.label,
        ...(hasNonEmptyGroups ? { rowSpan: 2 } : {}),
      })
    } else if (node.type === 'COLUMN_GROUP') {
      const leaves = collectLeafColumns(node)
      if (leaves.length === 0) {
        // Skip empty groups entirely
        continue
      }
      topRow.push({
        id: node.id,
        label: (node.props?.label as string | undefined) ?? '',
        colSpan: leaves.length,
        align: 'center',
      })
      for (const leaf of leaves) {
        const col = nodeToTableColumnDef(leaf)
        bottomRow.push({ id: col.id, label: col.label })
      }
    }
  }

  return { hasGroups: hasNonEmptyGroups, topRow, bottomRow }
}

/**
 * Ячейка шапки — ЛИСТОВАЯ колонка (у неё есть своя ширина и своя ручка ресайза),
 * а не групповой заголовок. Отдельного признака в модели нет намеренно:
 * групповая ячейка ВСЕГДА получает colSpan (число листьев ≥ 1), а листовая —
 * никогда. Все ячейки нижнего ряда листовые по построению.
 */
export function isLeafHeaderCell(cell: HeaderCell): boolean {
  return cell.colSpan === undefined
}
