import { type ReactNode, type RefObject, createElement } from 'react'
import type { ColumnDef, CellContext } from '@tanstack/react-table'

import type { ViewNode } from '../../types/view'
import type {
  TableRow,
  TableColumnDef,
  UseTableSyncResult,
} from '../hooks/use-table-sync'
import { TableCellEditor } from '../../ui/nodes/composite/table-cell-editor'
import { ColumnHeaderLabel } from '../../ui/nodes/composite/column-header-label'
import type { UseTableValidationResult } from '../hooks/use-table-validation'
import { resolveRowFilterParams } from './resolve-row-filter-params'
import { resolveCellState } from './resolve-cell-state'
import { columnSizeProps } from './column-sizing'
import { isNoWrapColumn } from './nowrap-columns'
import type { AutoAdvanceTarget } from './table-auto-advance'
import {
  VERTICAL_SUB_ROW_HEIGHT,
  maxVerticalSubRows,
  verticalSubRows,
} from './vertical-sub-rows'
import { extractAllLeafColumns, nodeToTableColumnDef } from './table-column-def'

// Ре-экспорт перемещённых при декомпозиции символов — сохранение публичной
// точки модуля (все внешние импортёры и vi.mock тестов смотрят сюда), не
// barrel сегмента.
export { VERTICAL_SUB_ROW_HEIGHT, verticalSubRows }
export { extractAllLeafColumns, nodeToTableColumnDef }

/**
 * Контекст потокового ввода (SCRUM-363), пробрасываемый в редакторы ячеек.
 * Цель — в ref (а не в значении): колонки мемоизированы по node.children, и
 * смена цели не должна пересобирать их (пересборка ремонтирует редактор и
 * сбрасывает фокус).
 */
export interface AutoAdvanceColumnContext {
  targetRef: RefObject<AutoAdvanceTarget | null>
  onCellCommit: (rowId: string, binding: string) => void
}

/** Ячейка — текущая одноразовая цель автофокуса? */
function isAutoOpenTarget(
  ctx: AutoAdvanceColumnContext | undefined,
  rowId: string,
  binding: string
): boolean {
  const target = ctx?.targetRef.current
  return !!target && target.rowId === rowId && target.binding === binding
}

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
  /**
   * Итоги под-колонок VERTICAL-группы — по слоту на под-строку, `null` там, где
   * у под-колонки итога нет. Ключ слота — `id` УЗЛА колонки: именно им бэк
   * адресует значения в карте `<binding>.footer` (плоской, без вложенности).
   * <p>
   * Отдельный проп нужен потому, что вертикальная группа рендерится ОДНОЙ
   * колонкой TanStack: собственного `columnDef.footer` под-колонки не получают,
   * и без этого списка их итоги пропадали, хотя `footer=true` на них стоит
   * (дефект 04.09.2026: в «Среднем заработке» больничного отрисовывались 4 итога
   * из 8 — ровно те, что лежат в TABLE напрямую).
   */
  footerKeys?: (string | null)[]
  /**
   * Общее число под-строк вертикальных групп таблицы — та же величина, по
   * которой строится сетка шапки и ячейки. Подвал обязан взять её же, иначе
   * стопка итогов встанет по другой сетке, чем стопка значений.
   */
  subRowCount?: number
}

/**
 * Содержимое заголовка колонки: подпись, обрезаемая многоточием по ширине
 * колонки, с красным «*» у обязательной не-readonly колонки (SCRUM-329).
 * Возвращает СЫРОЙ ReactNode: годится как `content` вертикальной группы; для
 * плоского `header` (тип TanStack — string|функция, не элемент) оборачивается
 * в `() => …`.
 *
 * Голую строку не возвращаем даже для необязательной колонки: обрезку держит
 * `ColumnHeaderLabel`, и без него подпись переносилась бы на вторую строку,
 * наезжая на соседний заголовок.
 */
function columnHeaderContent(col: TableColumnDef): ReactNode {
  return createElement(ColumnHeaderLabel, {
    label: col.label,
    required: col.required && !col.readonly,
  })
}

/**
 * ADR-0029 Phase 2b: фабрика server-driven аффордансов пикера ячейки.
 *
 * <p>Строится вызывающим (там, где доступен `dispatch`), потому что команда в
 * `col.actions` «голая» — один action на колонку, минтится при композиции, когда
 * строка ещё неизвестна. Координату строки добавляет фабрика, получая её здесь.
 * Возвращает пустой объект ⇒ ячейка уходит в легаси-пикер (двойной путь, BL-2).
 */
export type CellRefHandlersFactory = (
  col: TableColumnDef,
  row: TableRow
) => {
  onServerShowAll?: () => void
  onServerCreate?: () => void
  onServerOpen?: () => void
}

/** Общие зависимости редакторов ячеек — один набор на всю сборку колонок. */
interface CellEditorDeps {
  syncRef: RefObject<UseTableSyncResult>
  validationRef?: RefObject<UseTableValidationResult>
  autoAdvance?: AutoAdvanceColumnContext
  cellRefHandlers?: CellRefHandlersFactory
}

/**
 * Редактор одной ячейки. Единая точка для плоской колонки и под-колонки
 * VERTICAL-группы — раньше этот же набор пропов был написан в файле дважды и
 * версии расходились.
 */
function buildCellEditorElement(
  col: TableColumnDef,
  row: TableRow,
  deps: CellEditorDeps
): ReactNode {
  const { syncRef, validationRef, autoAdvance, cellRefHandlers } = deps
  // Доступность и обязательность считаются на ЯЧЕЙКЕ, а не на колонке:
  // строка несёт собственное условное состояние (см. resolve-cell-state).
  const state = resolveCellState(col, row)
  return createElement(TableCellEditor, {
    cellWidget: col.cellWidget,
    dataType: col.dataType,
    value: row[col.binding],
    readonly: state.readonly,
    required: state.required,
    noWrap: isNoWrapColumn(col.binding, col.label),
    revealErrors: validationRef?.current.revealErrors ?? false,
    props: col.props,
    extraParams: resolveRowFilterParams(col, row),
    binding: col.binding,
    autoOpen: isAutoOpenTarget(autoAdvance, row.rowId, col.binding),
    // ADR-0029 Phase 2b: пусто ⇒ легаси-пикер (двойной путь).
    ...(cellRefHandlers?.(col, row) ?? {}),
    onChange: (val: unknown) => {
      syncRef.current.updateCell(row.rowId, col.binding, val)
    },
    onCommit: () => {
      syncRef.current.commitCell()
      autoAdvance?.onCellCommit(row.rowId, col.binding)
    },
  })
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
  validationRef?: RefObject<UseTableValidationResult>,
  autoAdvance?: AutoAdvanceColumnContext,
  cellRefHandlers?: CellRefHandlersFactory
): ColumnDef<TableRow>[] {
  // Число под-строк считается по ВСЕЙ таблице и одно на все вертикальные
  // группы — иначе их разделители встают на разной высоте (см. verticalSubRows).
  return buildColumnDefsInner(
    children,
    { syncRef, validationRef, autoAdvance, cellRefHandlers },
    maxVerticalSubRows(children)
  )
}

function buildColumnDefsInner(
  children: ViewNode[] | undefined,
  deps: CellEditorDeps,
  subRowCount: number
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
        ...columnSizeProps(node.props),
        accessorFn: (row: TableRow) => row[col.binding],
        // TanStack `header` — string | функция; сырой элемент недопустим,
        // поэтому подпись оборачиваем в render-функцию (flexRender её вызовет).
        header: () => columnHeaderContent(col),
        cell: (info: CellContext<TableRow, unknown>) =>
          buildCellEditorElement(col, info.row.original, deps),
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

        // Итоги под-колонок: слот на под-строку, null — итога нет. Порядок тот
        // же, что у шапки и ячейки (visibleChildren), поэтому итог встаёт под
        // своим значением.
        const footerKeys = visibleChildren.map((child) =>
          child.props?.footer === true ? child.id : null
        )
        const meta: SduiColumnMetaExtra = {
          verticalGroup: true,
          ...(footerKeys.some((key) => key !== null)
            ? { footerKeys, subRowCount }
            : {}),
        }

        const colDef: ColumnDef<TableRow> = {
          id: groupId,
          // VERTICAL-группа рендерится ОДНОЙ колонкой, поэтому ширины берутся с
          // узла группы, а не с под-колонок.
          ...columnSizeProps(node.props),
          meta,
          header:
            subLabels.length > 0
              ? () =>
                  verticalSubRows(
                    subLabels.map((col) => ({
                      key: col.id,
                      content: columnHeaderContent(col),
                    })),
                    16,
                    true,
                    subRowCount
                  )
              : () => createElement(ColumnHeaderLabel, { label: groupLabel }),
          cell: (info: CellContext<TableRow, unknown>) =>
            verticalSubRows(
              visibleChildren.map((child) => {
                const childCol = nodeToTableColumnDef(child)
                return {
                  key: childCol.id,
                  content: buildCellEditorElement(
                    childCol,
                    info.row.original,
                    deps
                  ),
                }
              }),
              0,
              false,
              subRowCount
            ),
        }
        result.push(colDef)
      } else {
        // Horizontal group (default): multi-level header via TanStack grouped columns
        const colDef: ColumnDef<TableRow> = {
          id: groupId,
          header: () => createElement(ColumnHeaderLabel, { label: groupLabel }),
          columns: buildColumnDefsInner(node.children, deps, subRowCount),
        }
        result.push(colDef)
      }
      continue
    }
  }

  return result
}
