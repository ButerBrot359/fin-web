import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table'
import { Paper, Table, TableBody, TableContainer } from '@mui/material'

import type { ViewNode, TableCommandDescriptor } from '../../../types/view'
import {
  useTableSync,
  type TableColumnDef,
  type TableRow,
} from '../../../lib/hooks/use-table-sync'
import { useCellRefHandlers } from '../../../lib/hooks/use-cell-ref-handlers'
import { useCellValueApplier } from '../../../lib/hooks/use-cell-value-applier'
import { useTableSearch } from '../../../lib/hooks/use-table-search'
import { useSearchScroll } from '../../../lib/hooks/use-search-scroll'
import { useTableRowCommands } from '../../../lib/hooks/use-table-row-commands'
import { useFormSaveCommand } from '../../../lib/hooks/use-form-save-command'
import { navestiFokusNaTablitsu } from '../../../lib/utils/table-keyboard-focus'
import { useTableMultiSelection } from '../../../lib/hooks/use-table-multi-selection'
import { useTableScrollContainer } from '../../../lib/hooks/use-table-scroll-container'
import { windowedRows } from '../../../lib/utils/virtual-window'
import { useRowActivate } from '../../../lib/hooks/use-row-activate'
import { useRowOpen } from '../../../lib/hooks/use-row-open'
import { useTableValidation } from '../../../lib/hooks/use-table-validation'
import { useTableRowErrorIndexes } from '../../../lib/validation/table-row-errors'
import { isColumnVisible } from '../../../lib/utils/column-visibility'
import { parseRowAppearance } from '../../../lib/utils/row-appearance'
import { useExternalRowFilter } from '../../../lib/hooks/use-external-row-filter'
import { useSduiColumnSizing } from '../../../lib/hooks/use-sdui-column-sizing'
import { buildFlatColumnDefs } from '../../../lib/utils/build-flat-column-defs'
import { EditableTableHead } from './editable-table-head'
import { ROW_NUMBER_WIDTH, TableSizingColgroup } from './table-sizing-colgroup'
import { editableTableSx } from './editable-table-sx'
import { buildColumnBackgroundMap } from '../../../lib/utils/column-background'
import { TableToolbar } from './table-toolbar'
import { TableBodyRow } from './table-body-row'
import { TableEmptyRow } from './table-empty-row'
import { VirtualSpacerRow } from './virtual-spacer-row'

interface EditableTableProps {
  node: ViewNode
  columns: TableColumnDef[]
}

export const EditableTable: FC<EditableTableProps> = ({ node, columns }) => {
  // ADR-0029 Phase 2b: server-ref-команды пикера ячейки; dispatch через ref
  // (тот же приём и та же причина, что у syncRef ниже) — см. use-cell-ref-handlers.
  const cellRefHandlers = useCellRefHandlers()
  const allowAdd = node.props?.allowAdd === true
  const allowDelete = node.props?.allowDelete === true
  const allowReorder = node.props?.allowReorder === true
  const showRowNumbers = node.props?.showRowNumbers === true

  const tableCommands = node.props?.tableCommands as
    | TableCommandDescriptor[]
    | undefined

  // Постоянная заливка колонок (column-background.ts): ячейка на TanStack знает
  // только id колонки, props остались в исходном описании.
  const columnBackgrounds = useMemo(
    () => buildColumnBackgroundMap(columns),
    [columns]
  )

  // Правила условной заливки строк — см. row-appearance.ts.
  const rowAppearance = useMemo(
    () => parseRowAppearance(node.props),
    [node.props]
  )

  // Колонки СИНХРОНИЗАЦИИ — все, включая скрытые: на них держатся ключи
  // master-detail и служебные значения, они обязаны попадать в новую строку и
  // в EVENT (§111/§273). Рисуются только видимые — см. visibleColumns ниже.
  const sync = useTableSync(node, columns)
  // Стабильная ссылка на актуальный sync для мемоизированных cell-колбэков:
  // без неё useMemo(tableColumns) захватил бы устаревший sync. Методы sync
  // читают refs, поэтому доступ через syncRef.current корректен.
  const syncRef = useRef(sync)
  syncRef.current = sync

  useCellValueApplier(columns, syncRef)

  const validation = useTableValidation(node)
  const validationRef = useRef(validation)
  validationRef.current = validation
  const rowErrors = useTableRowErrorIndexes(node.binding)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  // Активация строки уходит на сервер только если бэк прислал action
  // с trigger='activate' у этой ТЧ (props.rowActivate)
  const activateRow = useRowActivate(node)
  // Двойной клик по строке уходит на сервер только если бэк прислал action
  // с trigger='open' у этой ТЧ (props.rowOpen) — §2 спеки формы строки.
  // Контракт общий для любой ТЧ, поэтому подключён и здесь, не только у свёртки.
  const openRow = useRowOpen(node)

  // Всё, что видит пользователь, строится отсюда: шапка, ячейки, подвал, поиск,
  // colSpan пустой таблицы. Скрытая колонка не рендерится и не ищется.
  const visibleColumns = useMemo(
    () => columns.filter(isColumnVisible),
    [columns]
  )

  // Отбор строк внешним списком (порт 1С `ОтборСтрок`) считается ДО поиска,
  // виртуализации и операций тулбара: всё перечисленное обязано работать над тем
  // же набором, который реально отрисован, иначе индексы разъезжаются с экраном.
  const visibleRows = useExternalRowFilter(node, sync.rows)

  // Позиция видимой строки в ПОЛНОМ массиве: `selectedIndex` и `row.index`
  // TanStack'а нумеруют отфильтрованный набор, а мутации sync принимают индекс
  // полного (SCRUM-282 C1, тот же приём, что в ComplexEditableTable).
  const globalIndexOf = (visibleIndex: number | null): number => {
    if (visibleIndex === null) return -1
    const rowId = visibleRows[visibleIndex]?.rowId
    return sync.rows.findIndex((r) => r.rowId === rowId)
  }

  const selectedRowId =
    selectedIndex != null ? (visibleRows[selectedIndex]?.rowId ?? null) : null

  // Выделение НЕСКОЛЬКИХ строк (Ctrl/Shift/Ctrl+A) поверх текущей строки — как в 1С.
  const vybor = useTableMultiSelection(visibleRows)

  // Выделение живёт только при текущей строке: её снимают и снаружи, и тогда «Удалить»
  // обязана погаснуть вместе с ней.
  const vydelennyeRowIds = selectedRowId === null ? [] : vybor.vydelennyeRowIds

  const search = useTableSearch(
    visibleRows,
    visibleColumns.map((c) => ({ id: c.id, binding: c.binding }))
  )

  // Виртуализация SCRUM-368 + внутренний скролл SCRUM-327 — общий контейнер.
  const { containerRef, virt, maxHeight, minHeight, setContainerRef } =
    useTableScrollContainer(node, visibleRows.length)

  useSearchScroll(search, visibleRows, virt, containerRef)

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return null
      if (prev >= visibleRows.length)
        return visibleRows.length > 0 ? visibleRows.length - 1 : null
      return prev
    })
  }, [visibleRows.length])

  // Мемоизируем колонки по [visibleColumns]: при ре-рендере EditableTable (ввод
  // символа → setLocalRows) определения колонок/cell-функций НЕ пересоздаются,
  // поэтому TanStack не ремонтит ячейку и инпут сохраняет фокус — см.
  // build-flat-column-defs.
  const tableColumns = useMemo<ColumnDef<TableRow>[]>(
    () =>
      buildFlatColumnDefs({
        visibleColumns,
        syncRef,
        validationRef,
        cellRefHandlers,
      }),
    [visibleColumns, cellRefHandlers]
  )

  const sizing = useSduiColumnSizing(node)

  // Отбор по внешнему списку (панель сотрудников, порт 1С ОтборСтрок): при
  // пустом отборе возвращает те же строки, поэтому ветку рендера не двоим.
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

  // Ctrl+S из ТЧ — та же команда записи, что у кнопки «Записать» формы.
  const saveForm = useFormSaveCommand()

  const commands = useTableRowCommands({
    sync,
    columns,
    visibleRows,
    selectedRowId,
    selectedRowIds: vydelennyeRowIds,
    selectedVisibleIndex: selectedIndex ?? -1,
    onAdd: () => {
      sync.addRow(columns)
    },
    clearSelection: () => {
      setSelectedIndex(null)
      vybor.tolkoOdna(null)
    },
    // Селекция здесь индексная, а хук оперирует rowId — переводим по видимому набору.
    selectRow: (rowId) => {
      const index = visibleRows.findIndex((row) => row.rowId === rowId)
      if (index >= 0) setSelectedIndex(index)
      vybor.tolkoOdna(rowId)
    },
    selectAll: vybor.vydelitVse,
    extendSelection: vybor.rasshirit,
    globalIndexOf,
    // Индексная селекция: выделение сдвигается вслед за перемещённой строкой.
    onMoved: (toVisibleIndex) => {
      setSelectedIndex(toVisibleIndex)
    },
    search,
    onSave: saveForm,
  })

  return (
    <div
      tabIndex={-1}
      data-sdui-table-keyboard="true"
      style={{
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        minHeight: 0,
      }}
      onKeyDown={commands.handleKeyDown}
      onPaste={commands.handlePasteEvent}
    >
      <div style={{ marginBottom: 8 }}>
        <TableToolbar
          {...commands.toolbarProps}
          allowAdd={allowAdd}
          allowReorder={allowReorder}
          allowDelete={allowDelete}
          commands={tableCommands}
          search={search}
          selectedRowId={selectedRowId}
          selectedRowIds={vydelennyeRowIds}
        />
      </div>
      <TableContainer
        component={Paper}
        ref={setContainerRef}
        data-own-scroll="true"
        onMouseDown={navestiFokusNaTablitsu}
        sx={{
          flex: '1 1 auto',
          overflowY: 'auto',
          ...(maxHeight != null && { maxHeight }),
          // Пол высоты растянутой карточки — см. minHeight в
          // useTableViewportMaxHeight: без него ТЧ схлопывалась до шапки колонок.
          ...(minHeight != null && { minHeight }),
        }}
      >
        {/* Шапка колонок видима при внутреннем скролле (SCRUM-327) */}
        <Table size="small" stickyHeader sx={tableSx}>
          {sizing.isResizable && (
            <TableSizingColgroup
              table={table}
              leadingWidth={showRowNumbers ? ROW_NUMBER_WIDTH : undefined}
            />
          )}
          <EditableTableHead
            table={table}
            showRowNumbers={showRowNumbers}
            isResizable={sizing.isResizable}
          />
          <TableBody ref={virt.setBodyRef}>
            {table.getRowModel().rows.length === 0 ? (
              <TableEmptyRow
                colSpan={visibleColumns.length + (showRowNumbers ? 1 : 0)}
              />
            ) : (
              <>
                {virt.paddingTop > 0 && (
                  <VirtualSpacerRow
                    height={virt.paddingTop}
                    colSpan={columns.length + (showRowNumbers ? 1 : 0)}
                  />
                )}
                {windowedRows(virt.virtualItems, table.getRowModel().rows).map(
                  (row) => (
                    <TableBodyRow
                      key={row.id}
                      row={row}
                      selected={
                        selectedIndex === row.index ||
                        vybor.vydelennye.has(row.original.rowId)
                      }
                      rowError={rowErrors.has(row.index)}
                      onRowClick={(event) => {
                        setSelectedIndex(row.index)
                        vybor.klik(row.original.rowId, row.index, {
                          ctrl: event.ctrlKey || event.metaKey,
                          shift: event.shiftKey,
                        })
                        activateRow(row.id)
                      }}
                      onRowDoubleClick={(event) => {
                        openRow(row.id, event)
                      }}
                      showRowNumbers={showRowNumbers}
                      rowAppearance={rowAppearance}
                      columnBackgrounds={columnBackgrounds}
                      searchCurrent={search.current}
                      isVirtualized={virt.isVirtualized}
                      measureRow={virt.measureRow}
                    />
                  )
                )}
                {virt.paddingBottom > 0 && (
                  <VirtualSpacerRow
                    height={virt.paddingBottom}
                    colSpan={columns.length + (showRowNumbers ? 1 : 0)}
                  />
                )}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
