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
import { columnSizeProps, toColumnWidth } from './column-sizing'
import { isNoWrapColumn } from './nowrap-columns'
import type { AutoAdvanceTarget } from './table-auto-advance'

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
}

/**
 * Минимальная высота одной под-строки VERTICAL-группы. Единая сетка для шапки и
 * ячейки: i-я подпись стоит ровно над i-м редактором (эталон 1С — две
 * «под-строки» в одной колонке). Пара с ROW_HEIGHT в
 * `complex-editable-table.tsx`, который считает минимальную высоту строки как
 * 2 × это значение.
 */
export const VERTICAL_SUB_ROW_HEIGHT = 36

/**
 * Стопка под-строк VERTICAL-группы: равные по высоте под-строки + разделитель
 * между ними (как линия сетки в 1С).
 *
 * @param paddingX горизонтальный отступ под-строки: 16px в шапке (совпасть с
 *                 остальными заголовками MUI), 0 в ячейке (у редакторов свой)
 * @param clip     обрезать содержимое по границам под-строки. Только для ШАПКИ:
 *                 подпись, не влезшая в ширину, не должна вылезать на соседнюю
 *                 под-строку. В ЯЧЕЙКЕ обрезать нельзя — у редакторов есть то,
 *                 что законно выходит за их границы (рамка обязательного поля,
 *                 focus-ring), и `overflow:hidden` срезал бы её
 *
 * КАК ДЕРЖИТСЯ ОБЩАЯ СЕТКА СТРОКИ. Значения в ТЧ переносятся по ширине колонки
 * (как во вкладке «Вычеты ИПН», где вертикальных групп нет), поэтому жёсткой
 * высоты у под-строки быть не может: длинное ФИО занимает две строки текста.
 * Вместо неё:
 *   1) контейнер стопки тянется во всю высоту ячейки (`height: 100%`), а ячейки
 *      строки таблицы по природе `<tr>` одной высоты;
 *   2) под-строки — треки грида `1fr` (то есть `minmax(auto, 1fr)`): при
 *      измерении контента трек не меньше своего содержимого И все треки
 *      выравниваются по самому высокому, а при готовой высоте ячейки делят её
 *      поровну.
 * Отсюда: разделитель под-строк во ВСЕХ колонках строки встаёт на одной высоте
 * (эталон 1С — единая линия), а содержимое при этом не обрезается. Прежняя
 * жёсткая `height` тот же результат давала ценой обрезки значений многоточием.
 *
 * ОДИНАКОВОЕ ЧИСЛО ТРЕКОВ ВО ВСЕХ КОЛОНКАХ (`subRowCount`). Треков всегда
 * столько, сколько под-колонок у САМОЙ БОЛЬШОЙ вертикальной группы таблицы, а
 * не сколько их у этой группы. Иначе равные `1fr`-треки делят одну и ту же
 * высоту строки на разное число частей: в «Сотрудник / Вид занятости / Вид
 * деятельности» разделители встают на 1/3 и 2/3 высоты, а в соседнем
 * «Подразделение / Должность» — на 1/2, и линии сетки идут по строке
 * ступеньками. Группа с меньшим числом под-колонок занимает ПЕРВЫЕ треки
 * общей сетки, хвост остаётся пустым — так же, как в эталоне 1С.
 *
 * <p>Пустые треки рисуются наравне с заполненными (и с тем же разделителем):
 * иначе линия сетки обрывалась бы на колонке, у которой под-колонок меньше.
 */
interface SubRowItem {
  key: string
  content: ReactNode
}

function verticalSubRows(
  items: SubRowItem[],
  paddingX: number,
  clip: boolean,
  subRowCount: number
): ReactNode {
  // Хвостовые слоты пустые — у группы с меньшим числом под-колонок (тип шире
  // элемента массива: индекс за пределами items даёт undefined).
  const slots: (SubRowItem | undefined)[] = Array.from(
    { length: Math.max(subRowCount, items.length) },
    (_, index) => items[index]
  )
  return createElement(
    'div',
    {
      style: {
        height: '100%',
        display: 'grid',
        // minmax(0, 1fr), а не дефолтный auto-трек: auto-трек не сжимается ниже
        // ширины содержимого, поэтому длинная подпись растягивала бы его и
        // вылезала за границы колонки вместо обрезки многоточием. Редакторы при
        // этом по-прежнему занимают всю ширину ячейки (1fr).
        gridTemplateColumns: 'minmax(0, 1fr)',
        gridTemplateRows: `repeat(${String(slots.length)}, 1fr)`,
      },
    },
    ...slots.map((item, index) =>
      createElement(
        'div',
        {
          key: item?.key ?? `empty-${String(index)}`,
          className: index > 0 ? 'border-t border-ui-03' : undefined,
          style: {
            // Пол высоты — общий для всех колонок: строка с короткими
            // значениями не должна схлопываться (см. док-комментарий выше).
            minHeight: VERTICAL_SUB_ROW_HEIGHT,
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            alignContent: 'center',
            ...(clip ? { overflow: 'hidden' } : {}),
            paddingLeft: paddingX,
            paddingRight: paddingX,
            boxSizing: 'border-box' as const,
          },
        },
        item?.content ?? null
      )
    )
  )
}

/**
 * Сколько под-строк у самой большой VERTICAL-группы поддерева. Ноль — если
 * вертикальных групп нет вовсе.
 *
 * <p>Считается по ВСЕЙ таблице и раздаётся всем группам: общая сетка под-строк
 * — единственное, что держит линии разделителей на одной высоте по всей строке
 * (см. док-комментарий verticalSubRows).
 */
function maxVerticalSubRows(children: ViewNode[] | undefined): number {
  if (!children) return 0

  let max = 0
  for (const node of children) {
    if (node.props?.visible === false) continue
    if ((node.type as string) !== 'COLUMN_GROUP') continue

    const orientation =
      (node.props?.orientation as string | undefined) ?? 'HORIZONTAL'
    if (orientation === 'VERTICAL') {
      const visible = (node.children ?? []).filter(
        (child) => child.props?.visible !== false
      )
      max = Math.max(max, visible.length)
      continue
    }
    // HORIZONTAL-группа — многоуровневая шапка: вертикальные группы могут
    // лежать внутри неё, и их сетка та же самая.
    max = Math.max(max, maxVerticalSubRows(node.children))
  }
  return max
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
  autoAdvance?: AutoAdvanceColumnContext
): ColumnDef<TableRow>[] {
  // Число под-строк считается по ВСЕЙ таблице и одно на все вертикальные
  // группы — иначе их разделители встают на разной высоте (см. verticalSubRows).
  return buildColumnDefsInner(
    children,
    syncRef,
    validationRef,
    maxVerticalSubRows(children),
    autoAdvance
  )
}

function buildColumnDefsInner(
  children: ViewNode[] | undefined,
  syncRef: RefObject<UseTableSyncResult>,
  validationRef: RefObject<UseTableValidationResult> | undefined,
  subRowCount: number,
  autoAdvance?: AutoAdvanceColumnContext
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
        cell: (info: CellContext<TableRow, unknown>) => {
          // Доступность и обязательность считаются на ЯЧЕЙКЕ, а не на колонке:
          // строка несёт собственное условное состояние (см. resolve-cell-state).
          const state = resolveCellState(col, info.row.original)
          return createElement(TableCellEditor, {
            cellWidget: col.cellWidget,
            dataType: col.dataType,
            value: info.row.original[col.binding],
            readonly: state.readonly,
            required: state.required,
            noWrap: isNoWrapColumn(col.binding, col.label),
            revealErrors: validationRef?.current.revealErrors ?? false,
            props: col.props,
            extraParams: resolveRowFilterParams(col, info.row.original),
            binding: col.binding,
            autoOpen: isAutoOpenTarget(
              autoAdvance,
              info.row.original.rowId,
              col.binding
            ),
            onChange: (val: unknown) => {
              syncRef.current.updateCell(
                info.row.original.rowId,
                col.binding,
                val
              )
            },
            onCommit: () => {
              syncRef.current.commitCell()
              autoAdvance?.onCellCommit(info.row.original.rowId, col.binding)
            },
          })
        },
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
          // VERTICAL-группа рендерится ОДНОЙ колонкой, поэтому ширины берутся с
          // узла группы, а не с под-колонок.
          ...columnSizeProps(node.props),
          meta: { verticalGroup: true },
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
                const state = resolveCellState(childCol, info.row.original)
                return {
                  key: childCol.id,
                  content: createElement(TableCellEditor, {
                    cellWidget: childCol.cellWidget,
                    dataType: childCol.dataType,
                    value: info.row.original[childCol.binding],
                    readonly: state.readonly,
                    required: state.required,
                    noWrap: isNoWrapColumn(childCol.binding, childCol.label),
                    revealErrors: validationRef?.current.revealErrors ?? false,
                    props: childCol.props,
                    extraParams: resolveRowFilterParams(
                      childCol,
                      info.row.original
                    ),
                    binding: childCol.binding,
                    autoOpen: isAutoOpenTarget(
                      autoAdvance,
                      info.row.original.rowId,
                      childCol.binding
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
                      autoAdvance?.onCellCommit(
                        info.row.original.rowId,
                        childCol.binding
                      )
                    },
                  }),
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
          columns: buildColumnDefsInner(
            node.children,
            syncRef,
            validationRef,
            subRowCount,
            autoAdvance
          ),
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
    // Ширины ресайза (контракт бэка): width — начальная ширина, minWidth — пол
    // при перетаскивании (приходит редко), resizable эмитится только как false.
    width: toColumnWidth(props.width),
    minWidth: toColumnWidth(props.minWidth),
    resizable: props.resizable as boolean | undefined,
    cellWidget: (props.cellWidget as string | undefined) ?? 'TEXT_FIELD',
    dataType: (props.dataType as string | undefined) ?? 'STRING',
    readonly: (props.readonly as boolean | undefined) ?? false,
    required: (props.required as boolean | undefined) ?? false,
    props,
  }
}
