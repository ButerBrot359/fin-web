import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow as MuiTableRow,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import {
  HEAVY_ROW_VIRTUAL_OPTIONS,
  useVirtualTableRows,
} from '@/shared/lib/virtual-rows/use-virtual-table-rows'

import type { ViewNode, TableCommandDescriptor } from '../../../types/view'
import {
  useTableSync,
  type TableColumnDef,
  type TableRow,
} from '../../../lib/hooks/use-table-sync'
import { useTableViewportMaxHeight } from '../../../lib/hooks/use-table-viewport-max-height'
import { useSduiDispatch } from '../../../lib/dispatch'
import {
  registerCellValueApplier,
  unregisterCellValueApplier,
} from '../../../lib/cell-value-appliers'
import {
  useTableSearch,
  isSearchHit,
} from '../../../lib/hooks/use-table-search'
import { createTableHotkeysHandler } from '../../../lib/utils/table-hotkeys'
import { readVirtualization } from '../../../lib/utils/pagination'
import { useRowActivate } from '../../../lib/hooks/use-row-activate'
import { useRowOpen } from '../../../lib/hooks/use-row-open'
import { useTableValidation } from '../../../lib/hooks/use-table-validation'
import { resolveCellState } from '../../../lib/utils/resolve-cell-state'
import { isColumnVisible } from '../../../lib/utils/column-visibility'
import { omitServiceRowKeys } from '../../../lib/utils/service-row-keys'
import {
  parseRowAppearance,
  resolveRowBackground,
} from '../../../lib/utils/row-appearance'
import { useExternalRowFilter } from '../../../lib/hooks/use-external-row-filter'
import { useSduiColumnSizing } from '../../../lib/hooks/use-sdui-column-sizing'
import { columnSizeProps } from '../../../lib/utils/column-sizing'
import { EditableTableHead } from './editable-table-head'
import { ROW_NUMBER_WIDTH, TableSizingColgroup } from './table-sizing-colgroup'
import { TableCellEditor } from './table-cell-editor'
import { isNoWrapColumn } from '../../../lib/utils/nowrap-columns'
import { ColumnHeaderLabel } from './column-header-label'
import { SearchHitCell } from './table-search-cell'
import { TABLE_GRID_SX } from './table-grid-sx'
import { tableTextColorSx } from '../../../lib/utils/table-text-color'
import { buildColumnBackgroundMap } from '../../../lib/utils/column-background'
import { TableToolbar } from './table-toolbar'

interface EditableTableProps {
  node: ViewNode
  columns: TableColumnDef[]
}

export const EditableTable: FC<EditableTableProps> = ({ node, columns }) => {
  const { t } = useTranslation()
  // ADR-0029 Phase 2b. Через ref, а НЕ захватом в мемо-колонки: dispatch не
  // референциально стабилен (deps location/navigate/session/queryClient), и его
  // захват пересоздавал бы cell-рендер, роняя фокус в редактируемой ячейке —
  // тот же приём и та же причина, что у syncRef ниже.
  const dispatch = useSduiDispatch()
  const dispatchRef = useRef(dispatch)
  dispatchRef.current = dispatch
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

  // ADR-0029: значение, выбранное/созданное для строки БЕЗ БД-id, сервер применить не может —
  // он возвращает его эффектом без applyToParentCommand, а кладём его мы (см.
  // cell-value-appliers). Колонку узнаём по id узла, строку — по rowId.
  useEffect(() => {
    const token = registerCellValueApplier((columnNodeId, rowId, value) => {
      const col = columns.find((c) => c.id === columnNodeId)
      if (!col) return false
      syncRef.current.updateCell(rowId, col.binding, value)
      syncRef.current.commitCell()
      return true
    })
    return () => {
      unregisterCellValueApplier(token)
    }
  }, [columns])

  const validation = useTableValidation(node)
  const validationRef = useRef(validation)
  validationRef.current = validation
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

  const search = useTableSearch(
    visibleRows,
    visibleColumns.map((c) => ({ id: c.id, binding: c.binding }))
  )
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Виртуализация строк (SCRUM-368): в DOM — только видимое окно. Ниже порога
  // хука рендер прежний (все строки).
  const virt = useVirtualTableRows(
    visibleRows.length,
    readVirtualization(node),
    HEAVY_ROW_VIRTUAL_OPTIONS
  )
  // SCRUM-327: вертикальный скролл живёт внутри ТЧ (maxHeight по вьюпорту),
  // страница документа не растягивается; окно виртуализации — от контейнера.
  const viewport = useTableViewportMaxHeight()
  const setContainerRef = (node: HTMLDivElement | null) => {
    containerRef.current = node
    viewport.setNode(node)
    virt.setContainerRef(node)
  }

  // Скролл к текущему совпадению поиска (§6.5: поиск не фильтрует строки).
  // При виртуализации строка совпадения может быть вне окна — сначала подводим
  // окно к её индексу, затем после кадра доводим по горизонтали к самой ячейке.
  useEffect(
    () => {
      const current = search.current
      if (!current) return
      const idx = visibleRows.findIndex((r) => r.rowId === current.rowId)
      if (idx >= 0) virt.scrollToRow(idx)
      requestAnimationFrame(() => {
        containerRef.current
          ?.querySelector('[data-search-hit="true"]')
          ?.scrollIntoView({ block: 'nearest' })
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search.current?.rowId, search.current?.columnId]
  )

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (prev === null) return null
      if (prev >= visibleRows.length)
        return visibleRows.length > 0 ? visibleRows.length - 1 : null
      return prev
    })
  }, [visibleRows.length])

  // Мемоизируем колонки по [columns]: при ре-рендере EditableTable (ввод символа →
  // setLocalRows) определения колонок/cell-функций НЕ пересоздаются, поэтому TanStack
  // не ремонтит ячейку и инпут сохраняет фокус. cell-колбэки берут актуальный sync
  // через syncRef.current.
  const tableColumns = useMemo<ColumnDef<TableRow>[]>(
    () =>
      visibleColumns.map((col) => ({
        id: col.id,
        accessorFn: (row: TableRow) => row[col.binding],
        // TanStack `header` — string | функция (не элемент): подпись всегда
        // оборачиваем в render-функцию. ColumnHeaderLabel обрезает её
        // многоточием по ширине колонки — иначе длинный заголовок переносится
        // и наезжает на соседний (SCRUM-329).
        header: () => (
          <ColumnHeaderLabel
            label={col.label}
            required={col.required && !col.readonly}
          />
        ),
        // Ширина колонки: с бэка (props.width) либо прежний фолбэк 150/flex.
        ...columnSizeProps(col.props),
        size: col.width ?? (col.flex ? undefined : 150),
        cell: ({ row }) => {
          // Доступность и обязательность считаются на ЯЧЕЙКЕ, а не на колонке:
          // строка несёт собственное условное состояние (см. resolve-cell-state).
          const state = resolveCellState(col, row.original)
          // ADR-0029 Phase 2b: команда в actions «голая» (один action на колонку,
          // минтится при композиции, когда строка ещё неизвестна) — координату
          // строки добавляем здесь, в момент клика. Нет action ⇒ undefined,
          // и редактор ячейки уходит в легаси-пикер (двойной путь, BL-2).
          const serverRefHandler = (trigger: 'showAll' | 'create') => {
            // Строки БЕЗ БД-id (только что добавленные) тоже идут серверным путём: бэк для
            // них не ищет строку, а возвращает значение эффектом без applyToParentCommand,
            // и его кладёт на место relay-selection → applyCellValueLocally. Раньше здесь
            // стоял откат на легаси — он делал SDUI недоступным в главном сценарии
            // (заполнить строку нельзя, а сохранить её без заполнения тоже нельзя).
            const command = col.actions?.find(
              (a) => a.trigger === trigger && a.actionId === 'command'
            )?.command
            if (!command) return undefined
            return () => {
              void dispatchRef.current({
                type: 'COMMAND',
                command,
                sourceNodeId: col.id,
                value: { rowId: row.original.rowId, row: row.original },
              })
            }
          }
          return (
            <TableCellEditor
              cellWidget={col.cellWidget}
              dataType={col.dataType}
              value={row.original[col.binding]}
              readonly={state.readonly}
              props={col.props}
              required={state.required}
              noWrap={isNoWrapColumn(col.binding, col.label)}
              revealErrors={validationRef.current.revealErrors}
              onServerShowAll={serverRefHandler('showAll')}
              onServerCreate={serverRefHandler('create')}
              onChange={(val) => {
                syncRef.current.updateCell(row.original.rowId, col.binding, val)
              }}
              onCommit={() => {
                syncRef.current.commitCell()
              }}
            />
          )
        },
      })),
    [visibleColumns]
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

  // Сетка — всегда и во всех ТЧ: она не зависит ни от ресайза, ни от того, есть
  // ли среди детей COLUMN_GROUP. Раньше TABLE_GRID_SX стоял только в
  // complex-editable-table, а выбор компонента (table-node) завязан на наличие
  // группы — поэтому «Вычеты ИПН» с плоским списком колонок оставались без
  // вертикальных границ, а «Начисления» с группами их имели.
  // Фиксированные ширины — только при ресайзе: без columnsResizable раскладка
  // остаётся авто-шириной MUI, как до задачи.
  const tableSx = {
    ...TABLE_GRID_SX,
    ...tableTextColorSx(node.props),
    ...(sizing.isResizable
      ? {
          tableLayout: 'fixed' as const,
          width: table.getTotalSize() + (showRowNumbers ? ROW_NUMBER_WIDTH : 0),
          minWidth: '100%',
        }
      : {}),
  }

  const handleAdd = () => {
    sync.addRow(columns)
  }
  const handleRemove = () => {
    const globalIndex = globalIndexOf(selectedIndex)
    if (globalIndex >= 0) {
      sync.deleteRow(globalIndex)
      setSelectedIndex(null)
    }
  }
  const handleCopy = () => {
    if (selectedIndex === null) return
    const src = visibleRows[selectedIndex]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!src) return
    // Копируются ЗНАЧЕНИЯ строки: служебные ключи посчитаны для источника, и
    // без очистки копия заблокированной строки приезжала бы заблокированной
    // ещё до ответа сервера (см. service-row-keys).
    const { rowId: _rowId, ...values } = omitServiceRowKeys(src)
    sync.addRow(columns, values)
  }
  // Соседом считается соседняя ВИДИМАЯ строка: при активном отборе строки между
  // ними принадлежат другим сотрудникам, и перестановка через них сдвинула бы
  // чужие данные.
  const handleMoveUp = () => {
    if (selectedIndex === null || selectedIndex <= 0) return
    const from = globalIndexOf(selectedIndex)
    const to = globalIndexOf(selectedIndex - 1)
    if (from < 0 || to < 0) return
    sync.moveRow(from, to)
    setSelectedIndex(selectedIndex - 1)
  }
  const handleMoveDown = () => {
    if (selectedIndex === null || selectedIndex >= visibleRows.length - 1)
      return
    const from = globalIndexOf(selectedIndex)
    const to = globalIndexOf(selectedIndex + 1)
    if (from < 0 || to < 0) return
    sync.moveRow(from, to)
    setSelectedIndex(selectedIndex + 1)
  }

  const handleKeyDown = createTableHotkeysHandler({
    onAdd: handleAdd,
    onCopy: handleCopy,
    onRemove: handleRemove,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    onFocusSearch: search.focusInput,
    onClearSearch: search.clear,
  })

  return (
    <div
      tabIndex={-1}
      style={{
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        flexGrow: 1,
        minHeight: 0,
      }}
      onKeyDown={handleKeyDown}
    >
      <div style={{ marginBottom: 8 }}>
        <TableToolbar
          onAdd={handleAdd}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onRemove={handleRemove}
          onCopy={handleCopy}
          canMoveUp={selectedIndex !== null && selectedIndex > 0}
          canMoveDown={
            selectedIndex !== null && selectedIndex < visibleRows.length - 1
          }
          canRemove={selectedIndex !== null}
          canCopy={selectedIndex !== null}
          allowAdd={allowAdd}
          allowReorder={allowReorder}
          allowDelete={allowDelete}
          commands={tableCommands}
          search={search}
          selectedRowId={
            selectedIndex != null
              ? (visibleRows[selectedIndex]?.rowId ?? null)
              : null
          }
        />
      </div>
      <TableContainer
        component={Paper}
        ref={setContainerRef}
        data-own-scroll="true"
        sx={{
          flex: '1 1 auto',
          overflowY: 'auto',
          ...(viewport.maxHeight != null && { maxHeight: viewport.maxHeight }),
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
              <MuiTableRow>
                <TableCell
                  colSpan={visibleColumns.length + (showRowNumbers ? 1 : 0)}
                  align="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </MuiTableRow>
            ) : (
              <>
                {virt.paddingTop > 0 && (
                  <MuiTableRow aria-hidden="true">
                    <TableCell
                      colSpan={columns.length + (showRowNumbers ? 1 : 0)}
                      sx={{
                        height: virt.paddingTop,
                        p: 0,
                        border: 0,
                        // SCRUM-368: фантомные линии строк вместо белого при быстром скролле
                        background:
                          'repeating-linear-gradient(to bottom, transparent 0 119px, #e5e7eb 119px 120px)',
                      }}
                    />
                  </MuiTableRow>
                )}
                {(virt.virtualItems
                  ? virt.virtualItems.map(
                      (item) => table.getRowModel().rows[item.index]
                    )
                  : table.getRowModel().rows
                ).map((row) => (
                  <MuiTableRow
                    key={row.id}
                    hover
                    data-index={virt.isVirtualized ? row.index : undefined}
                    ref={virt.measureRow}
                    selected={selectedIndex === row.index}
                    onClick={() => {
                      setSelectedIndex(row.index)
                      activateRow(row.id)
                    }}
                    onDoubleClick={(event) => {
                      openRow(row.id, event)
                    }}
                    // Условная заливка (см. row-appearance.ts): простой
                    // backgroundColor, чтобы выделение и ховер MUI со своими
                    // более специфичными селекторами оставались видны поверх.
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: resolveRowBackground(
                        rowAppearance,
                        row.original
                      ),
                    }}
                  >
                    {showRowNumbers && (
                      <TableCell
                        sx={{ width: 48, textAlign: 'center', p: '4px 8px' }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          {row.index + 1}
                        </Typography>
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <SearchHitCell
                        key={cell.id}
                        isHit={isSearchHit(
                          search.current,
                          row.original.rowId,
                          cell.column.id
                        )}
                        backgroundColor={
                          // Условная заливка строки перекрывает постоянную
                          // заливку колонки — см. column-background.ts.
                          resolveRowBackground(rowAppearance, row.original)
                            ? undefined
                            : columnBackgrounds.get(cell.column.id)
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </SearchHitCell>
                    ))}
                  </MuiTableRow>
                ))}
                {virt.paddingBottom > 0 && (
                  <MuiTableRow aria-hidden="true">
                    <TableCell
                      colSpan={columns.length + (showRowNumbers ? 1 : 0)}
                      sx={{
                        height: virt.paddingBottom,
                        p: 0,
                        border: 0,
                        background:
                          'repeating-linear-gradient(to bottom, transparent 0 119px, #e5e7eb 119px 120px)',
                      }}
                    />
                  </MuiTableRow>
                )}
              </>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  )
}
