import { useMemo, useRef, type FC } from 'react'
import { useReactTable, getCoreRowModel } from '@tanstack/react-table'
import { Paper, Table, TableBody, TableContainer } from '@mui/material'

import type { ViewNode, TableCommandDescriptor } from '../../../types/view'
import { useTableSync } from '../../../lib/hooks/use-table-sync'
import { useTableSearch } from '../../../lib/hooks/use-table-search'
import { useSearchScroll } from '../../../lib/hooks/use-search-scroll'
import { useTableRowCommands } from '../../../lib/hooks/use-table-row-commands'
import { useRowSelectionIdentity } from '../../../lib/hooks/use-row-selection-identity'
import { useMasterDetailRows } from '../../../lib/hooks/use-master-detail-rows'
import { useAutoAdvance } from '../../../lib/hooks/use-auto-advance'
import { useStickyHeadOffset } from '../../../lib/hooks/use-sticky-head-offset'
import { useCellValueApplier } from '../../../lib/hooks/use-cell-value-applier'
import { useCellRefHandlers } from '../../../lib/hooks/use-cell-ref-handlers'
import { useTableScrollContainer } from '../../../lib/hooks/use-table-scroll-container'
import { windowedRows } from '../../../lib/utils/virtual-window'
import { useExternalRowFilter } from '../../../lib/hooks/use-external-row-filter'
import { useTableFooterValues } from '../../../lib/hooks/use-table-footer-values'
import { useRowActivate } from '../../../lib/hooks/use-row-activate'
import { useRowOpen } from '../../../lib/hooks/use-row-open'
import { useTableValidation } from '../../../lib/hooks/use-table-validation'
import { useTableRowErrorIndexes } from '../../../lib/validation/table-row-errors'
import { useSduiColumnSizing } from '../../../lib/hooks/use-sdui-column-sizing'
import {
  buildColumnDefs,
  extractAllLeafColumns,
  VERTICAL_SUB_ROW_HEIGHT,
} from '../../../lib/utils/build-column-defs'
import { parseRowAppearance } from '../../../lib/utils/row-appearance'
import { ROW_NUMBER_WIDTH, TableSizingColgroup } from './table-sizing-colgroup'
import { editableTableSx } from './editable-table-sx'
import { buildColumnBackgroundMap } from '../../../lib/utils/column-background'
import { TableToolbar } from './table-toolbar'
import { TableBodyRow } from './table-body-row'
import { TableEmptyRow } from './table-empty-row'
import { ComplexTableHead } from './complex-table-head'
import { ComplexTableFooter, tableHasFooter } from './complex-table-footer'
import { VirtualSpacerRow } from './virtual-spacer-row'

// Единая высота строки для master-detail пары (SCRUM-282 #3): в ячейках VERTICAL-групп
// стопки редакторов разной высоты (checkbox+text vs date+date), без общей высоты
// строки таблицы разъезжаются. height на <tr> работает как min-height.
// Считается из сетки под-строк VERTICAL-группы (две под-строки), иначе строка и
// стопка редакторов разъедутся при правке одной из двух величин.
// Позже уедет в конфиг-сервис стилей.
const ROW_HEIGHT = 2 * VERTICAL_SUB_ROW_HEIGHT

interface ComplexEditableTableProps {
  node: ViewNode
}

export const ComplexEditableTable: FC<ComplexEditableTableProps> = ({
  node,
}) => {
  // ADR-0029 Phase 2b: server-driven пикер в ячейке ТЧ — стабильная фабрика
  // с dispatch через ref (см. use-cell-ref-handlers / server-ref-commands).
  const cellRefHandlers = useCellRefHandlers()

  const allowAdd = node.props?.allowAdd === true
  const allowDelete = node.props?.allowDelete === true
  const allowReorder = node.props?.allowReorder === true
  const showRowNumbers = node.props?.showRowNumbers === true
  // SCRUM-363: потоковый ввод строк «как в 1С». Строго по серверному флагу —
  // без веток по коду документа/route (серверная SDUI-мета управляет областью).
  const autoAdvance = node.props?.autoAdvance === true

  const tableCommands = node.props?.tableCommands as
    | TableCommandDescriptor[]
    | undefined

  // Правила условной заливки строк (1С `УсловноеОформление`): разбираются один
  // раз на раскладку, а сработавшее правило ищется на каждой строке — признак
  // живёт в данных и меняется патчами.
  const rowAppearance = useMemo(
    () => parseRowAppearance(node.props),
    [node.props]
  )

  // Memoize columns by node.children — critical for preserving input focus
  const flatColumns = useMemo(
    () => extractAllLeafColumns(node.children),

    [node.children]
  )

  // Постоянная заливка колонок (column-background.ts): ячейка на TanStack знает
  // только id колонки, props остались в исходном описании.
  const columnBackgrounds = useMemo(
    () => buildColumnBackgroundMap(flatColumns),
    [flatColumns]
  )

  const sync = useTableSync(node, flatColumns)
  const syncRef = useRef(sync)

  // ── Master-detail filtering ──
  const { isMasterDetail, masterKeyValue, masterDetailRows, handleAdd } =
    useMasterDetailRows(node, sync.rows, flatColumns, sync.addRow)

  // У detail-ТЧ `allowAdd` — это СОСТОЯНИЕ ПРАВИЛА (бэк гоняет его патчами по
  // составу master: график вычета вводится только «по периодическим платежам»),
  // а не структурный запрет. Кнопку поэтому не прячем — как в эталоне 1С: она
  // остаётся активной, а на клик сервер снимает строку и объясняет причину своим
  // notify. Правило авторитетно на сервере, активная кнопка данные не портит
  // (frontend-spec-table-row-activate §3.4/§6).
  const showAdd = allowAdd || isMasterDetail

  // Отбор по внешнему списку (панель сотрудников) — независим от master-detail:
  // тот связывает ДВЕ ТЧ одного документа, этот фильтрует по витрине формы и не
  // трогает доступность команд таблицы.
  const visibleRows = useExternalRowFilter(node, masterDetailRows)

  const selection = useRowSelectionIdentity(node.binding, visibleRows)

  // Stable ref for memoized cell callbacks — avoids stale closures.
  // updateCell обёрнут: правка ВЫБРАННОЙ строки — собственный ввод
  // пользователя, а не подмена записи сервером (см. noteUserEdit в
  // use-row-selection-identity).
  syncRef.current = {
    ...sync,
    updateCell: (rowId: string, binding: string, value: unknown) => {
      selection.noteUserEdit(rowId)
      sync.updateCell(rowId, binding, value)
    },
  }

  useCellValueApplier(flatColumns, syncRef)

  const validation = useTableValidation(node)
  const validationRef = useRef(validation)
  validationRef.current = validation
  const rowErrors = useTableRowErrorIndexes(node.binding)

  // Виртуализация SCRUM-368 + внутренний скролл SCRUM-327 — общий контейнер;
  // окно виртуализации — по видимому (для master-detail уже отфильтрованному)
  // набору.
  const { containerRef, virt, maxHeight, minHeight, setContainerRef } =
    useTableScrollContainer(node, visibleRows.length)

  // ── SCRUM-363: потоковый ввод — механика автоперехода ──
  const { autoAdvanceCtx, handleAddWithAutoAdvance } = useAutoAdvance({
    enabled: autoAdvance,
    flatColumns,
    syncRef,
    handleAdd,
    containerRef,
  })

  const tableColumns = useMemo(
    () =>
      buildColumnDefs(
        node.children,
        syncRef,
        validationRef,
        autoAdvanceCtx,
        cellRefHandlers
      ),

    [node.children, autoAdvanceCtx, cellRefHandlers]
  )

  // ── Footer ──
  const footerValues = useTableFooterValues(node, visibleRows)
  const hasFooter = Boolean(footerValues && tableHasFooter(tableColumns))

  const sizing = useSduiColumnSizing(node)

  const table = useReactTable({
    data: visibleRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.rowId,
    enableColumnResizing: sizing.enableColumnResizing,
    columnResizeMode: sizing.columnResizeMode,
    state: { columnSizing: sizing.columnSizing },
    onColumnSizingChange: sizing.onColumnSizingChange,
  })

  // Сетка + фиксированные ширины при ресайзе — см. editable-table-sx.ts.
  const tableSx = editableTableSx(
    node.props,
    sizing.isResizable,
    table.getTotalSize() + (showRowNumbers ? ROW_NUMBER_WIDTH : 0)
  )

  // Серверная реакция на активацию строки — тот же момент, что и публикация
  // выбора для master-detail фильтра; фильтр остаётся клиентским.
  const activateRow = useRowActivate(node)

  // Двойной клик по строке — открыть форму строки (§2 спеки). Отдельный триггер
  // `open`: одиночный клик (activate + выделение) остаётся как был, двойной
  // добавляется сверху и выделение не трогает.
  const openRow = useRowOpen(node)

  const handleRowClick = (rowId: string) => {
    selection.selectRow(rowId)
    activateRow(rowId)
  }

  const search = useTableSearch(
    visibleRows,
    flatColumns.map((c) => ({ id: c.id, binding: c.binding }))
  )

  const { headTopOffset, setFirstHeadRowRef } = useStickyHeadOffset()

  useSearchScroll(search, visibleRows, virt, containerRef)

  const commands = useTableRowCommands({
    sync,
    columns: flatColumns,
    visibleRows,
    selectedRowId: selection.selectedRowId,
    selectedVisibleIndex: selection.selectedVisibleIndex,
    onAdd: handleAddWithAutoAdvance,
    clearSelection: selection.clearSelection,
    selectRow: selection.selectRow,
    // Reorder возможен только вне master-detail (allowReorder && !isMasterDetail
    // в тулбаре) — там visibleRows === sync.rows, поэтому видимый индекс
    // совпадает с глобальным и move корректен.
    globalIndexOf: (visibleIndex) => visibleIndex,
    search,
  })

  // Колонок в разметке — столько, сколько РИСУЕТСЯ. flatColumns.length
  // (extractAllLeafColumns) для этого не годится: он по своему контракту
  // считает и скрытые колонки, и каждую под-колонку VERTICAL-группы отдельно,
  // хотя группа рисуется одной ячейкой. У «Начислений» это дало бы 11 против
  // 6 реальных.
  const spacerColSpan =
    table.getVisibleLeafColumns().length + (showRowNumbers ? 1 : 0)

  return (
    // Тянемся на всю высоту колонки HSTACK, чтобы master и detail заканчивались
    // на одной линии: высоту задаёт та таблица, где строк больше, вторая
    // добирает пустым местом внизу — как в эталоне 1С. Вне HSTACK родитель не
    // flex, flexGrow игнорируется и высота остаётся по содержимому.
    // tabIndex/onKeyDown — хоткеи командной панели ТЧ (SCRUM-302).
    <div
      tabIndex={-1}
      onKeyDown={commands.handleKeyDown}
      style={{
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        minHeight: 0,
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <TableToolbar
          {...commands.toolbarProps}
          canMoveUp={!isMasterDetail && commands.canMoveUp}
          canMoveDown={!isMasterDetail && commands.canMoveDown}
          canAdd={!isMasterDetail || masterKeyValue !== undefined}
          allowAdd={showAdd}
          allowReorder={allowReorder && !isMasterDetail}
          allowDelete={allowDelete}
          commands={tableCommands}
          search={search}
          selectedRowId={selection.selectedRowId}
        />
      </div>
      {/* basis auto, а не 0: контейнер растёт до высоты колонки, но никогда не
          становится ниже собственного содержимого, если растягивать нечего. */}
      <TableContainer
        component={Paper}
        ref={setContainerRef}
        data-own-scroll="true"
        sx={{
          flex: '1 1 auto',
          // Высоту даёт либо замер по вьюпорту, либо растянутый предок — в обоих
          // случаях скролл внутренний, поэтому overflowY общий.
          overflowY: 'auto',
          ...(maxHeight != null && { maxHeight }),
          // Пол высоты растянутой карточки — см. minHeight в
          // useTableViewportMaxHeight: без него ТЧ схлопывалась до шапки колонок.
          ...(minHeight != null && { minHeight }),
        }}
      >
        <Table
          size="small"
          // Шапка колонок остаётся видимой при внутреннем скролле (SCRUM-327).
          // Двухуровневая шапка (VERTICAL-группы) тоже прилипает: MUI ставит
          // всем рядам top:0, и второй ряд наезжал бы на первый — поэтому его
          // ячейкам задаётся top = высота первого ряда (см. ComplexTableHead).
          stickyHeader
          sx={tableSx}
        >
          {sizing.isResizable && (
            <TableSizingColgroup
              table={table}
              leadingWidth={showRowNumbers ? ROW_NUMBER_WIDTH : undefined}
            />
          )}
          <ComplexTableHead
            table={table}
            showRowNumbers={showRowNumbers}
            headTopOffset={headTopOffset}
            setFirstHeadRowRef={setFirstHeadRowRef}
          />
          <TableBody ref={virt.setBodyRef}>
            {visibleRows.length === 0 ? (
              <TableEmptyRow colSpan={spacerColSpan} />
            ) : (
              <>
                {virt.paddingTop > 0 && (
                  <VirtualSpacerRow
                    height={virt.paddingTop}
                    colSpan={spacerColSpan}
                  />
                )}
                {windowedRows(virt.virtualItems, table.getRowModel().rows).map(
                  (row) => (
                    <TableBodyRow
                      key={row.id}
                      row={row}
                      selected={row.id === selection.selectedRowId}
                      onRowClick={(event) => {
                        handleRowClick(row.id)
                        // Ячейка-ссылка (props.cellHyperlink, порт CellHyperlink 1С)
                        // открывается ОДНИМ кликом — тем же событием, что двойной
                        // клик по строке, только жест другой.
                        if (
                          event.target instanceof Element &&
                          event.target.closest(
                            '[data-sdui-cell-hyperlink="true"]'
                          )
                        ) {
                          openRow(row.id, event)
                        }
                      }}
                      rowError={rowErrors.has(row.index)}
                      onRowDoubleClick={(event) => {
                        openRow(row.id, event)
                      }}
                      showRowNumbers={showRowNumbers}
                      rowAppearance={rowAppearance}
                      columnBackgrounds={columnBackgrounds}
                      searchCurrent={search.current}
                      isVirtualized={virt.isVirtualized}
                      measureRow={virt.measureRow}
                      sduiRowId={row.original.rowId}
                      rowHeight={ROW_HEIGHT}
                    />
                  )
                )}
                {virt.paddingBottom > 0 && (
                  <VirtualSpacerRow
                    height={virt.paddingBottom}
                    colSpan={spacerColSpan}
                  />
                )}
              </>
            )}
          </TableBody>
          {hasFooter && footerValues && (
            <ComplexTableFooter
              table={table}
              footerValues={footerValues}
              showRowNumbers={showRowNumbers}
            />
          )}
        </Table>
      </TableContainer>
    </div>
  )
}
