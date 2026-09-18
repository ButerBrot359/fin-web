import { tableTextColorSx } from '../../../lib/utils/table-text-color'
import { TABLE_GRID_SX } from './table-grid-sx'

/**
 * sx `<Table>` редактируемой ТЧ — общий для EditableTable и
 * ComplexEditableTable.
 *
 * Сетка (рамка + линии между колонками) — всегда и во всех ТЧ: она не зависит
 * ни от ресайза, ни от того, есть ли среди детей COLUMN_GROUP. Раньше
 * TABLE_GRID_SX стоял только в complex-editable-table, а выбор компонента
 * (table-node) завязан на наличие группы — поэтому «Вычеты ИПН» с плоским
 * списком колонок оставались без вертикальных границ, а «Начисления» с
 * группами их имели.
 *
 * Фиксированные ширины — только при ресайзе: без columnsResizable раскладка
 * остаётся прежней авто-шириной MUI (важно для многоуровневых шапок и футера).
 */
export function editableTableSx(
  nodeProps: Record<string, unknown> | undefined,
  isResizable: boolean,
  fixedWidth: number
): Record<string, unknown> {
  return {
    ...TABLE_GRID_SX,
    ...tableTextColorSx(nodeProps),
    ...(isResizable
      ? {
          tableLayout: 'fixed' as const,
          width: fixedWidth,
          minWidth: '100%',
        }
      : {}),
  }
}
