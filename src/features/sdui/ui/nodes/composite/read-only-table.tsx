import { useCallback, useMemo, type FC } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'

import { useVirtualTableRows } from '@/shared/lib/virtual-rows/use-virtual-table-rows'
import { ShimmerBlock } from '@/shared/ui/page-skeleton/page-skeleton'

import type { NodeProps } from '../../../types/view'
import { usePagedTableRows } from '../../../lib/hooks/use-paged-table-rows'
import { readVirtualization } from '../../../lib/utils/pagination'
import { renderCellValue } from '../../../lib/utils/cell-value'
import {
  SDUI_DEFAULT_COLUMN_WIDTH,
  SDUI_MIN_COLUMN_WIDTH,
} from '../../../lib/utils/column-sizing'
import {
  buildHeaderModel,
  extractReadOnlyColumns,
  isLeafHeaderCell,
  type HeaderCell,
  type ReadOnlyColumnDef,
} from '../../../lib/utils/read-only-header-model'
import {
  parseRowAppearance,
  resolveRowBackground,
} from '../../../lib/utils/row-appearance'
import { useManualColumnResize } from '../../../lib/hooks/use-manual-column-resize'
import { useSduiColumnSizing } from '../../../lib/hooks/use-sdui-column-sizing'
import { ColumnResizeHandle } from './column-resize-handle'
import { ColumnHeaderLabel } from './column-header-label'
import { PagedTableFooter } from './paged-table-footer'

interface SimpleTableRow {
  rowId: string
  [key: string]: unknown
}

/** Ширина служебной колонки «N» (showRowNumbers). */
const ROW_NUMBER_WIDTH = 48

/**
 * Read-only таблица (движения документа и прочие нередактируемые таблицы).
 *
 * <p>Рендер ОСТАВЛЕН ручным (MUI Table + двухрядная шапка из `buildHeaderModel`),
 * без перевода на TanStack Table: этот компонент показывает движения по всем
 * типам документов, а перевод шапки с colSpan/rowSpan на header groups —
 * переписывание рабочего кода ради единообразия. Ресайз добавлен «поверх»:
 * ширины едут через `<colgroup>`, перетаскивание — `useManualColumnResize`,
 * персист — тот же `useSduiColumnSizing`, что и у таблиц на TanStack (кода
 * localStorage здесь нет).
 */
export const ReadOnlyTable: FC<NodeProps> = ({ node }) => {
  const { t } = useTranslation()
  const label = node.props?.label as string | undefined
  const showRowNumbers = node.props?.showRowNumbers === true

  // SCRUM-368: INLINE — строки из state, PAGED (движения/журналы) — страницы
  // из source.url с догрузкой сентинелом/кнопкой (футер внизу таблицы).
  const paged = usePagedTableRows<SimpleTableRow>(node)
  const rows = paged.rows

  const columns = useMemo(
    () => extractReadOnlyColumns(node.children),
    [node.children]
  )
  const headerModel = useMemo(
    () => buildHeaderModel(node.children),
    [node.children]
  )

  // Правила условной заливки строк — см. row-appearance.ts.
  const rowAppearance = useMemo(
    () => parseRowAppearance(node.props),
    [node.props]
  )

  const sizing = useSduiColumnSizing(node)
  const { isResizable, columnSizing, getColumnWidth, setColumnWidth } = sizing

  const byId = useMemo(() => {
    const map = new Map<string, ReadOnlyColumnDef>()
    for (const col of columns) map.set(col.id, col)
    return map
  }, [columns])

  /** Ширина колонки: отклонение пользователя → ширина с бэка → дефолт. */
  const widthOf = useCallback(
    (columnId: string): number =>
      Object.hasOwn(columnSizing, columnId)
        ? columnSizing[columnId]
        : (byId.get(columnId)?.width ?? SDUI_DEFAULT_COLUMN_WIDTH),
    [columnSizing, byId]
  )

  const minWidthOf = useCallback(
    (columnId: string): number =>
      byId.get(columnId)?.minWidth ?? SDUI_MIN_COLUMN_WIDTH,
    [byId]
  )

  const resize = useManualColumnResize({
    getWidth: (columnId) =>
      getColumnWidth(columnId) ??
      byId.get(columnId)?.width ??
      SDUI_DEFAULT_COLUMN_WIDTH,
    getMinWidth: minWidthOf,
    onResize: setColumnWidth,
  })

  /** Тянуть можно листовую колонку, если бэк не запретил её персонально. */
  const canResize = (cell: HeaderCell): boolean =>
    isResizable &&
    isLeafHeaderCell(cell) &&
    byId.get(cell.id)?.resizable !== false

  const renderHeaderCell = (cell: HeaderCell) => (
    <TableCell
      key={cell.id}
      colSpan={cell.colSpan}
      rowSpan={cell.rowSpan}
      align={cell.align}
      // overflow:hidden — безусловно: обрезка заголовка нужна и без ресайза,
      // иначе подпись шире колонки выходит за её границы. position:relative
      // требуется только под абсолютную ручку ресайза.
      sx={{
        overflow: 'hidden',
        ...(isResizable ? { position: 'relative' } : {}),
      }}
    >
      <ColumnHeaderLabel label={cell.label} align={cell.align ?? 'left'} />
      {canResize(cell) && (
        <ColumnResizeHandle
          isResizing={resize.resizingColumnId === cell.id}
          onMouseDown={resize.mouseDownHandler(cell.id)}
          onTouchStart={resize.touchStartHandler(cell.id)}
        />
      )}
    </TableCell>
  )

  const totalWidth =
    columns.reduce((sum, col) => sum + widthOf(col.id), 0) +
    (showRowNumbers ? ROW_NUMBER_WIDTH : 0)

  // Виртуализация строк (SCRUM-368): в DOM живёт только видимое окно — движения
  // и прочие read-only ТЧ бывают на тысячи строк. Ниже порога хука рендер
  // прежний (все строки).
  const {
    isVirtualized,
    virtualItems,
    paddingTop,
    paddingBottom,
    setContainerRef,
    setBodyRef,
    measureRow,
  } = useVirtualTableRows(rows.length, readVirtualization(node))
  const renderedRows = virtualItems
    ? virtualItems.map((item) => ({
        row: rows[item.index],
        index: item.index,
      }))
    : rows.map((row, index) => ({ row, index }))
  const spacerColSpan = columns.length + (showRowNumbers ? 1 : 0)

  return (
    <div>
      {label && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 8,
            gap: 8,
          }}
        >
          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
            {label}
          </Typography>
        </div>
      )}
      <TableContainer component={Paper} ref={setContainerRef}>
        <Table
          size="small"
          sx={
            isResizable
              ? {
                  tableLayout: 'fixed',
                  width: totalWidth,
                  minWidth: '100%',
                }
              : undefined
          }
        >
          {/* Ширины — через <col>, а не через ячейки шапки: при двухрядной
              шапке первая строка занята группами с colSpan и ширин листовых
              колонок не задаёт. */}
          {isResizable && (
            <colgroup>
              {showRowNumbers && <col style={{ width: ROW_NUMBER_WIDTH }} />}
              {columns.map((col) => (
                <col key={col.id} style={{ width: widthOf(col.id) }} />
              ))}
            </colgroup>
          )}
          <TableHead>
            <TableRow>
              {showRowNumbers && (
                <TableCell
                  align="center"
                  rowSpan={headerModel.hasGroups ? 2 : undefined}
                  sx={{ width: ROW_NUMBER_WIDTH }}
                >
                  {t('table.rowNumber')}
                </TableCell>
              )}
              {headerModel.topRow.map(renderHeaderCell)}
            </TableRow>
            {headerModel.hasGroups && (
              <TableRow>{headerModel.bottomRow.map(renderHeaderCell)}</TableRow>
            )}
          </TableHead>
          <TableBody ref={setBodyRef}>
            {rows.length === 0 ? (
              paged.isLoading ? (
                // Первая страница PAGED-таблицы в полёте — шиммер-строки
                Array.from({ length: 6 }).map((_, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {showRowNumbers && <TableCell />}
                    {columns.map((col) => (
                      <TableCell key={col.id}>
                        <ShimmerBlock className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={spacerColSpan} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {paged.isError
                        ? t('sdui.requestError')
                        : t('table.empty')}
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            ) : (
              <>
                {paddingTop > 0 && (
                  <TableRow aria-hidden="true">
                    <TableCell
                      colSpan={spacerColSpan}
                      sx={{ height: paddingTop, p: 0, border: 0 }}
                    />
                  </TableRow>
                )}
                {renderedRows.map(({ row, index }) => (
                  <TableRow
                    key={row.rowId}
                    data-index={isVirtualized ? index : undefined}
                    ref={measureRow}
                    // Условная заливка строки (см. row-appearance.ts): правило
                    // живёт на узле таблицы, признак — в данных строки.
                    sx={{
                      backgroundColor: resolveRowBackground(rowAppearance, row),
                    }}
                  >
                    {showRowNumbers && (
                      <TableCell align="center">{index + 1}</TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell
                        key={col.id}
                        // overflowWrap:anywhere — безусловно: ширины колонок
                        // фиксированы, и «неразрывное» значение (код, счёт,
                        // номер без пробелов) без него не переносится, а при
                        // включённом ресайзе ещё и срезается overflow:hidden.
                        sx={{
                          overflowWrap: 'anywhere',
                          ...(isResizable ? { overflow: 'hidden' } : {}),
                        }}
                      >
                        {col.binding !== undefined
                          ? renderCellValue(row[col.binding])
                          : ''}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {paddingBottom > 0 && (
                  <TableRow aria-hidden="true">
                    <TableCell
                      colSpan={spacerColSpan}
                      sx={{ height: paddingBottom, p: 0, border: 0 }}
                    />
                  </TableRow>
                )}
                <PagedTableFooter state={paged} colSpan={spacerColSpan} />
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
