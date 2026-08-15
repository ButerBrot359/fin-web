import { type ReactNode, type RefObject, createElement } from 'react'
import type { ColumnDef, CellContext } from '@tanstack/react-table'

import type { ViewNode } from '../../types/view'
import type {
  TableRow,
  TableColumnDef,
  UseTableSyncResult,
} from '../hooks/use-table-sync'
import { TableCellEditor } from '../../ui/nodes/composite/table-cell-editor'
import { RequiredMark } from '../../ui/nodes/composite/required-mark'
import type { UseTableValidationResult } from '../hooks/use-table-validation'
import { resolveRowFilterParams } from './resolve-row-filter-params'
import { isCellRequired } from './is-cell-required'

/**
 * Кастомные поля в `ColumnDef.meta`. Читаются приведением типа на месте
 * использования — как `EavColumnMetaExtra` в `widgets/eav-entity-table`.
 * <p>
 * Модульную аугментацию `ColumnMeta` сюда заводить НЕЛЬЗЯ: интерфейс в
 * @tanstack/react-table пустой, и все существующие `meta: { metaCode: ... }`
 * проходят только благодаря этому — первое же объявленное свойство включает
 * excess-property-check и роняет сборку в чужих файлах (списки документов,
 * регистра бухгалтерии).
 */
export interface SduiColumnMetaExtra {
  /**
   * Колонка — VERTICAL-группа: её шапка сама держит сетку под-строк, поэтому
   * рендерер снимает с ячейки шапки собственные отступы (иначе подписи уезжают
   * вниз относительно редакторов на ту же величину padding'а).
   */
  verticalGroup?: boolean
}

/**
 * Высота одной под-строки VERTICAL-группы. Единая сетка для шапки и ячейки:
 * i-я подпись стоит ровно над i-м редактором (эталон 1С — две «под-строки» в
 * одной колонке). Пара с ROW_HEIGHT в `complex-editable-table.tsx`, который
 * считает высоту строки как 2 × это значение.
 */
export const VERTICAL_SUB_ROW_HEIGHT = 36

/**
 * Стопка под-строк VERTICAL-группы: фиксированная высота каждой + разделитель
 * между ними (как линия сетки в 1С). `display:grid` + `alignContent:center`
 * центрирует содержимое по вертикали, не отбирая у него ширину — редакторы
 * остаются во всю ячейку, как при прежнем `flex flex-col`.
 *
 * @param paddingX горизонтальный отступ под-строки: 16px в шапке (совпасть с
 *                 остальными заголовками MUI), 0 в ячейке (у редакторов свой)
 */
function verticalSubRows(
  items: { key: string; content: ReactNode }[],
  paddingX: number
): ReactNode {
  return createElement(
    'div',
    { className: 'flex flex-col' },
    ...items.map((item, index) =>
      createElement(
        'div',
        {
          key: item.key,
          className: index > 0 ? 'border-t border-ui-03' : undefined,
          style: {
            height: VERTICAL_SUB_ROW_HEIGHT,
            display: 'grid',
            alignContent: 'center',
            paddingLeft: paddingX,
            paddingRight: paddingX,
            boxSizing: 'border-box' as const,
          },
        },
        item.content
      )
    )
  )
}

/**
 * Содержимое заголовка колонки: label с красным «*» (RequiredMark), если
 * колонка обязательна и не readonly — иначе просто строка-label (SCRUM-329).
 * Возвращает СЫРОЙ ReactNode: годится как `content` вертикальной группы; для
 * плоского `header` (тип TanStack — string|функция, не элемент) оборачивается
 * в `() => …`.
 */
function columnHeaderContent(col: TableColumnDef): ReactNode {
  return col.required && !col.readonly
    ? createElement(RequiredMark, { label: col.label })
    : col.label
}

/**
 * Recursively builds TanStack Table column definitions from SDUI ViewNode children.
 *
 * - TABLE_COLUMN  → leaf ColumnDef with cell editor
 * - COLUMN_GROUP / orientation=HORIZONTAL (default) → grouped columns (multi-level header)
 * - COLUMN_GROUP / orientation=VERTICAL → single column with stacked editors in one cell
 *
 * Nodes with props.visible === false are excluded from rendering.
 */
export function buildColumnDefs(
  children: ViewNode[] | undefined,
  syncRef: RefObject<UseTableSyncResult>,
  validationRef?: RefObject<UseTableValidationResult>
): ColumnDef<TableRow>[] {
  if (!children) return []

  const result: ColumnDef<TableRow>[] = []

  for (const node of children) {
    // Skip hidden nodes
    if (node.props?.visible === false) continue

    const nodeType = node.type as string

    if (nodeType === 'TABLE_COLUMN') {
      const col = nodeToTableColumnDef(node)
      const colDef: ColumnDef<TableRow> = {
        id: col.id,
        accessorFn: (row: TableRow) => row[col.binding],
        // TanStack `header` — string | функция; сырой элемент недопустим,
        // поэтому маркер оборачиваем в render-функцию (flexRender её вызовет),
        // а обычную колонку оставляем строкой-label (SCRUM-329).
        header:
          col.required && !col.readonly
            ? () => columnHeaderContent(col)
            : col.label,
        cell: (info: CellContext<TableRow, unknown>) =>
          createElement(TableCellEditor, {
            cellWidget: col.cellWidget,
            dataType: col.dataType,
            value: info.row.original[col.binding],
            readonly: col.readonly,
            // Обязательность считается на ЯЧЕЙКЕ, а не на колонке: строка может
            // быть помечена условно обязательной через `__requiredCells`.
            required: isCellRequired(col, info.row.original),
            revealErrors: validationRef?.current.revealErrors ?? false,
            props: col.props,
            extraParams: resolveRowFilterParams(col, info.row.original),
            onChange: (val: unknown) => {
              syncRef.current.updateCell(
                info.row.original.rowId,
                col.binding,
                val
              )
            },
            onCommit: () => {
              syncRef.current.commitCell()
            },
          }),
        ...(node.props?.footer === true ? { footer: col.id } : {}),
      }
      result.push(colDef)
      continue
    }

    if (nodeType === 'COLUMN_GROUP') {
      const orientation =
        (node.props?.orientation as string | undefined) ?? 'HORIZONTAL'
      const groupId = node.id
      const groupLabel = (node.props?.label as string | undefined) ?? ''

      if (orientation === 'VERTICAL') {
        // Vertical group: single column, cell renders stacked editors
        const visibleChildren = (node.children ?? []).filter(
          (child) => child.props?.visible !== false
        )

        // Шапка VERTICAL-группы: подписи под-колонок СТОПКОЙ, по одной над своим
        // редактором — как в эталоне 1С («Предоставлять вычет» ↑ / «Основание» ↓),
        // а не единый заголовок группы. Шапка и ячейка строятся ОДНИМ
        // verticalSubRows — отсюда и совпадение сетки, и общий разделитель
        // (frontend-spec-ipn-vertical-group-header.md §1).
        // Fallback на groupLabel — если все под-колонки скрыты или без подписей:
        // пустая шапка читалась бы как сломанная колонка.
        const subLabels = visibleChildren
          .map((child) => nodeToTableColumnDef(child))
          .filter((col) => col.label !== '')

        const colDef: ColumnDef<TableRow> = {
          id: groupId,
          meta: { verticalGroup: true },
          header:
            subLabels.length > 0
              ? () =>
                  verticalSubRows(
                    subLabels.map((col) => ({
                      key: col.id,
                      content: columnHeaderContent(col),
                    })),
                    16
                  )
              : groupLabel,
          cell: (info: CellContext<TableRow, unknown>) =>
            verticalSubRows(
              visibleChildren.map((child) => {
                const childCol = nodeToTableColumnDef(child)
                return {
                  key: childCol.id,
                  content: createElement(TableCellEditor, {
                    cellWidget: childCol.cellWidget,
                    dataType: childCol.dataType,
                    value: info.row.original[childCol.binding],
                    readonly: childCol.readonly,
                    required: isCellRequired(childCol, info.row.original),
                    revealErrors: validationRef?.current.revealErrors ?? false,
                    props: childCol.props,
                    extraParams: resolveRowFilterParams(
                      childCol,
                      info.row.original
                    ),
                    onChange: (val: unknown) => {
                      syncRef.current.updateCell(
                        info.row.original.rowId,
                        childCol.binding,
                        val
                      )
                    },
                    onCommit: () => {
                      syncRef.current.commitCell()
                    },
                  }),
                }
              }),
              0
            ),
        }
        result.push(colDef)
      } else {
        // Horizontal group (default): multi-level header via TanStack grouped columns
        const colDef: ColumnDef<TableRow> = {
          id: groupId,
          header: groupLabel,
          columns: buildColumnDefs(node.children, syncRef, validationRef),
        }
        result.push(colDef)
      }
      continue
    }
  }

  return result
}

/**
 * Recursively extracts ALL leaf TABLE_COLUMN nodes from a ViewNode tree,
 * including hidden columns (visible === false). This is used to give
 * useTableSync the full column list for buildEmptyRow and dirty tracking —
 * hidden columns may carry master-detail keys needed in data.
 */
export function extractAllLeafColumns(
  children: ViewNode[] | undefined
): TableColumnDef[] {
  if (!children) return []

  const result: TableColumnDef[] = []

  for (const node of children) {
    const nodeType = node.type as string
    if (nodeType === 'TABLE_COLUMN') {
      result.push(nodeToTableColumnDef(node))
    } else if (nodeType === 'COLUMN_GROUP') {
      result.push(...extractAllLeafColumns(node.children))
    }
  }

  return result
}

/** Maps a TABLE_COLUMN ViewNode to the TableColumnDef shape. */
export function nodeToTableColumnDef(node: ViewNode): TableColumnDef {
  const props = node.props ?? {}
  return {
    id: node.id,
    label: (props.label as string | undefined) ?? '',
    binding: node.binding ?? (props.binding as string | undefined) ?? node.id,
    flex: props.flex as number | string | undefined,
    cellWidget: (props.cellWidget as string | undefined) ?? 'TEXT_FIELD',
    dataType: (props.dataType as string | undefined) ?? 'STRING',
    readonly: (props.readonly as boolean | undefined) ?? false,
    required: (props.required as boolean | undefined) ?? false,
    props,
  }
}
