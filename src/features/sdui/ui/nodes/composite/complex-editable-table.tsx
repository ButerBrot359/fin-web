import { useState, useEffect, useMemo, useRef, type FC } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow as MuiTableRow,
  Typography,
} from '@mui/material'
import { useTranslation } from 'react-i18next'

import type { ViewNode, TableCommandDescriptor } from '../../../types/view'
import { useTableSync, type TableRow } from '../../../lib/hooks/use-table-sync'
import {
  useTableSearch,
  isSearchHit,
} from '../../../lib/hooks/use-table-search'
import { createTableHotkeysHandler } from '../../../lib/utils/table-hotkeys'
import { useRowActivate } from '../../../lib/hooks/use-row-activate'
import { useRowOpen } from '../../../lib/hooks/use-row-open'
import { useTableValidation } from '../../../lib/hooks/use-table-validation'
import { useSduiColumnSizing } from '../../../lib/hooks/use-sdui-column-sizing'
import {
  useSduiSession,
  useBindingValue,
} from '../../../lib/sdui-session-context'
import {
  buildColumnDefs,
  extractAllLeafColumns,
  VERTICAL_SUB_ROW_HEIGHT,
  type SduiColumnMetaExtra,
} from '../../../lib/utils/build-column-defs'
import { renderCellValue } from '../../../lib/utils/cell-value'
import {
  findSelectedMasterRow,
  filterDetailRows,
  rowContentSignature,
} from '../../../lib/utils/master-detail'
import { ColumnResizeHandle } from './column-resize-handle'
import { ROW_NUMBER_WIDTH, TableSizingColgroup } from './table-sizing-colgroup'
import { SearchHitCell } from './table-search-cell'
import { TableToolbar } from './table-toolbar'

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
  const { t } = useTranslation()
  const { getValue, setFromServer } = useSduiSession()

  const allowAdd = node.props?.allowAdd === true
  const allowDelete = node.props?.allowDelete === true
  const allowReorder = node.props?.allowReorder === true
  const showRowNumbers = node.props?.showRowNumbers === true

  const tableCommands = node.props?.tableCommands as
    | TableCommandDescriptor[]
    | undefined

  // Master-detail props
  const masterTable = node.props?.masterTable as string | undefined
  const masterKey = node.props?.masterKey as string | undefined
  const detailKey = node.props?.detailKey as string | undefined
  const isMasterDetail = Boolean(masterTable && masterKey && detailKey)

  // У detail-ТЧ `allowAdd` — это СОСТОЯНИЕ ПРАВИЛА (бэк гоняет его патчами по
  // составу master: график вычета вводится только «по периодическим платежам»),
  // а не структурный запрет. Кнопку поэтому не прячем — как в эталоне 1С: она
  // остаётся активной, а на клик сервер снимает строку и объясняет причину своим
  // notify. Правило авторитетно на сервере, активная кнопка данные не портит
  // (frontend-spec-table-row-activate §3.4/§6).
  const showAdd = allowAdd || isMasterDetail

  // Memoize columns by node.children — critical for preserving input focus
  const flatColumns = useMemo(
    () => extractAllLeafColumns(node.children),

    [node.children]
  )

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  // Подпись содержимого выбранной строки на момент выбора — пара «id +
  // подпись» (SCRUM-291 §0.5 дефект 2). Устойчивого id строки в контракте
  // нет: у части типов документов (ИПН) rowId — порядковый номер, и
  // пересборка ТЧ перенумеровывает строки заново, поэтому «та же запись»
  // определяется по содержимому, а не по rowId. Пара, а не голая строка:
  // без rowId в паре переход на другую строку (другое содержимое, другой
  // rowId) выглядел бы как подмена под старым rowId.
  const selectedSignatureRef = useRef<{
    rowId: string
    signature: string
  } | null>(null)

  const sync = useTableSync(node, flatColumns)
  // Stable ref for memoized cell callbacks — avoids stale closures.
  // updateCell обёрнут: правка ВЫБРАННОЙ строки — собственный ввод
  // пользователя, а не подмена записи сервером. Сброс захваченной подписи
  // ПЕРЕД вызовом настоящего updateCell — эффект ниже увидит «подписи ещё
  // нет» на следующем рендере и просто пере-снимет свежую, не сочтя правку
  // подменой (иначе обе редактируемые таблицы ИПН теряли бы выделение на
  // каждый введённый символ).
  const syncRef = useRef(sync)
  syncRef.current = {
    ...sync,
    updateCell: (rowId: string, binding: string, value: unknown) => {
      if (rowId === selectedRowId) {
        selectedSignatureRef.current = null
      }
      sync.updateCell(rowId, binding, value)
    },
  }

  const validation = useTableValidation(node)
  const validationRef = useRef(validation)
  validationRef.current = validation

  const tableColumns = useMemo(
    () => buildColumnDefs(node.children, syncRef, validationRef),

    [node.children]
  )

  // ── Master-detail filtering ──
  // Реактивные подписки (SCRUM-282 #4): getValue давал разовый снимок,
  // detail не ре-рендерился при выборе master-строки.
  const selectedMasterRowId = useBindingValue(
    isMasterDetail && masterTable ? masterTable + '.__selectedRowId' : undefined
  ) as string | undefined
  const masterRows = useBindingValue(
    isMasterDetail && masterTable ? masterTable : undefined
  ) as TableRow[] | undefined

  const selectedMasterRow = findSelectedMasterRow(
    masterRows,
    selectedMasterRowId
  )
  const masterKeyValue =
    selectedMasterRow && masterKey ? selectedMasterRow[masterKey] : undefined

  const visibleRows = useMemo<TableRow[]>(() => {
    if (!isMasterDetail || !masterKey || !detailKey) return sync.rows
    return filterDetailRows(sync.rows, selectedMasterRow, masterKey, detailKey)
  }, [sync.rows, isMasterDetail, masterKey, detailKey, selectedMasterRow])

  // Индекс выбранной строки в текущем видимом наборе (не в полном sync.rows —
  // при активном master-detail фильтре это разные массивы, SCRUM-282 C1).
  const selectedVisibleIndex =
    selectedRowId != null
      ? visibleRows.findIndex((r) => r.rowId === selectedRowId)
      : -1

  // Сброс выбора, если выбранная строка выпала из видимого набора (смена
  // master-строки, удаление/фильтрация — SCRUM-282 I2) ИЛИ была подменена
  // сервером под тем же rowId (SCRUM-291 §0.5 дефект 2): у части типов
  // документов (ИПН и другие, где строки ТЧ собирает хендлер) rowId —
  // порядковый номер, и пересборка ТЧ перенумеровывает строки заново — номер
  // остаётся, запись за ним меняется. Устойчивого id строки в контракте пока
  // нет, поэтому «та же запись» определяется по содержимому
  // (`rowContentSignature`), а не по rowId.
  //
  // ВАЖНО: сброс снимает и публикацию выбора в сторе
  // (`setFromServer(..., null)`), не только локальный `selectedRowId` —
  // detail-таблица фильтрует именно по опубликованному значению
  // (`masterTable + '.__selectedRowId'`), и без снятия публикации она
  // продолжила бы показывать чужой график даже после локального сброса.
  //
  // Остаточная неточность (сознательный размен): серверная нормализация
  // значения уже ВЫБРАННОЙ строки (например, округление) тоже прочитается
  // как подмена и сбросит выделение — «безопасный», хоть и избыточный, сброс
  // предпочтительнее «опасной» пропущенной подмены, пока нет устойчивого id
  // строки (ADR-0027 или его аналог).
  useEffect(() => {
    if (selectedRowId == null) {
      selectedSignatureRef.current = null
      return
    }

    const resetSelection = () => {
      selectedSignatureRef.current = null
      setSelectedRowId(null)
      if (node.binding) {
        setFromServer(node.binding + '.__selectedRowId', null)
      }
    }

    const row = visibleRows.find((r) => r.rowId === selectedRowId)
    if (row === undefined) {
      resetSelection()
      return
    }

    const signature = rowContentSignature(row)
    const captured = selectedSignatureRef.current
    const substituted =
      captured !== null &&
      captured.rowId === selectedRowId &&
      captured.signature !== signature

    if (substituted) {
      resetSelection()
      return
    }

    selectedSignatureRef.current = { rowId: selectedRowId, signature }
  }, [visibleRows, selectedRowId, node.binding, setFromServer])

  // ── Footer ──
  const footerValues = node.binding
    ? (getValue(node.binding + '.footer') as
        | Record<string, unknown>
        | undefined)
    : undefined

  const hasFooter = Boolean(
    footerValues &&
    tableColumns.some((col) => {
      // Check if any leaf column (recursively) has a footer defined
      const hasFooterDef = (c: (typeof tableColumns)[number]): boolean => {
        if ('columns' in c && Array.isArray(c.columns)) {
          return c.columns.some(hasFooterDef)
        }
        return Boolean(c.footer)
      }
      return hasFooterDef(col)
    })
  )

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

  // Фиксированные ширины — только при ресайзе; иначе раскладка остаётся
  // прежней авто-шириной MUI (важно для многоуровневых шапок и футера).
  const tableSx = sizing.isResizable
    ? {
        tableLayout: 'fixed' as const,
        width: table.getTotalSize() + (showRowNumbers ? ROW_NUMBER_WIDTH : 0),
        minWidth: '100%',
      }
    : undefined

  // Серверная реакция на активацию строки — тот же момент, что и публикация
  // выбора для master-detail фильтра; фильтр остаётся клиентским.
  const activateRow = useRowActivate(node)

  // Двойной клик по строке — открыть форму строки (§2 спеки). Отдельный триггер
  // `open`: одиночный клик (activate + выделение) остаётся как был, двойной
  // добавляется сверху и выделение не трогает.
  const openRow = useRowOpen(node)

  // Publish selected rowId to session for detail tables
  const handleRowClick = (rowId: string) => {
    setSelectedRowId(rowId)
    if (node.binding) {
      setFromServer(node.binding + '.__selectedRowId', rowId)
    }
    activateRow(rowId)
  }

  // Detail-таблица: новая строка сразу получает ключ связи выбранной master-строки;
  // без выбранной master-строки добавление заблокировано (canAdd ниже) — как в 1С.
  const handleAdd = () => {
    if (isMasterDetail && detailKey) {
      if (masterKeyValue === undefined) return
      sync.addRow(flatColumns, { [detailKey]: masterKeyValue })
      return
    }
    sync.addRow(flatColumns)
  }
  // Удаляем по rowId из ПОЛНОГО массива sync.rows (SCRUM-282 C1): selectedVisibleIndex
  // указывает на позицию в отфильтрованном visibleRows и не годится для sync.deleteRow.
  const handleRemove = () => {
    if (selectedRowId === null) return
    const globalIndex = sync.rows.findIndex((r) => r.rowId === selectedRowId)
    if (globalIndex >= 0) sync.deleteRow(globalIndex)
    setSelectedRowId(null)
  }
  // Копия строки: существующий addRow с пресетами из выбранной строки (без rowId —
  // buildEmptyRow сгенерирует новый tmp-id). Ссылочные ячейки {id, presentation}
  // копируются как есть.
  const handleCopy = () => {
    if (selectedRowId === null) return
    const src = sync.rows.find((r) => r.rowId === selectedRowId)
    if (!src) return
    const { rowId: _rowId, ...values } = src
    sync.addRow(flatColumns, values)
  }
  // Reorder возможен только вне master-detail (allowReorder && !isMasterDetail в
  // тулбаре) — там visibleRows === sync.rows, поэтому selectedVisibleIndex совпадает
  // с глобальным индексом и move корректен.
  const handleMoveUp = () => {
    if (selectedVisibleIndex > 0) {
      sync.moveRow(selectedVisibleIndex, selectedVisibleIndex - 1)
    }
  }
  const handleMoveDown = () => {
    if (
      selectedVisibleIndex >= 0 &&
      selectedVisibleIndex < visibleRows.length - 1
    ) {
      sync.moveRow(selectedVisibleIndex, selectedVisibleIndex + 1)
    }
  }

  const search = useTableSearch(
    visibleRows,
    flatColumns.map((c) => ({ id: c.id, binding: c.binding }))
  )
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Скролл к текущему совпадению поиска (§6.5: поиск не фильтрует строки).
  useEffect(
    () => {
      if (!search.current) return
      containerRef.current
        ?.querySelector('[data-search-hit="true"]')
        ?.scrollIntoView({ block: 'nearest' })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [search.current?.rowId, search.current?.columnId]
  )

  const leafColumnCount = flatColumns.length || 1

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
    // Тянемся на всю высоту колонки HSTACK, чтобы master и detail заканчивались
    // на одной линии: высоту задаёт та таблица, где строк больше, вторая
    // добирает пустым местом внизу — как в эталоне 1С. Вне HSTACK родитель не
    // flex, flexGrow игнорируется и высота остаётся по содержимому.
    // tabIndex/onKeyDown — хоткеи командной панели ТЧ (SCRUM-302).
    <div
      tabIndex={-1}
      onKeyDown={handleKeyDown}
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
          onAdd={handleAdd}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onRemove={handleRemove}
          onCopy={handleCopy}
          canMoveUp={!isMasterDetail && selectedVisibleIndex > 0}
          canMoveDown={
            !isMasterDetail &&
            selectedVisibleIndex >= 0 &&
            selectedVisibleIndex < visibleRows.length - 1
          }
          canRemove={selectedRowId !== null}
          canCopy={selectedRowId !== null}
          canAdd={!isMasterDetail || masterKeyValue !== undefined}
          allowAdd={showAdd}
          allowReorder={allowReorder && !isMasterDetail}
          allowDelete={allowDelete}
          commands={tableCommands}
          search={search}
          selectedRowId={selectedRowId}
        />
      </div>
      {/* basis auto, а не 0: контейнер растёт до высоты колонки, но никогда не
          становится ниже собственного содержимого, если растягивать нечего. */}
      <TableContainer
        component={Paper}
        ref={containerRef}
        sx={{ flex: '1 1 auto' }}
      >
        <Table size="small" sx={tableSx}>
          {sizing.isResizable && (
            <TableSizingColgroup
              table={table}
              leadingWidth={showRowNumbers ? ROW_NUMBER_WIDTH : undefined}
            />
          )}
          <TableHead>
            {table.getHeaderGroups().map((hg, hgIndex) => (
              <MuiTableRow key={hg.id}>
                {showRowNumbers && hgIndex === 0 && (
                  <TableCell
                    rowSpan={table.getHeaderGroups().length}
                    sx={{
                      width: ROW_NUMBER_WIDTH,
                      textAlign: 'center',
                      fontWeight: 600,
                    }}
                  >
                    {t('table.rowNumber')}
                  </TableCell>
                )}
                {hg.headers.map((header) => {
                  if (header.isPlaceholder) {
                    return (
                      <TableCell key={header.id} colSpan={header.colSpan} />
                    )
                  }
                  // VERTICAL-группа сама держит сетку под-строк и рисует
                  // разделитель во всю ширину — свой padding ячейки сдвинул бы
                  // подписи вниз относительно редакторов и обрезал линию.
                  const extra = header.column.columnDef.meta as
                    | SduiColumnMetaExtra
                    | undefined
                  // Ручка — только на ЛИСТОВОЙ колонке: групповой заголовок
                  // (subHeaders непусты) шириной не владеет, её задают листья.
                  const canResizeHere =
                    header.subHeaders.length === 0 &&
                    header.column.getCanResize()
                  return (
                    <TableCell
                      key={header.id}
                      colSpan={header.colSpan}
                      sx={{
                        ...(extra?.verticalGroup ? { p: 0 } : {}),
                        ...(sizing.isResizable
                          ? { position: 'relative', overflow: 'hidden' }
                          : {}),
                      }}
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {canResizeHere && (
                        <ColumnResizeHandle
                          isResizing={header.column.getIsResizing()}
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                        />
                      )}
                    </TableCell>
                  )
                })}
              </MuiTableRow>
            ))}
          </TableHead>
          <TableBody>
            {visibleRows.length === 0 ? (
              <MuiTableRow>
                <TableCell
                  colSpan={leafColumnCount + (showRowNumbers ? 1 : 0)}
                  align="center"
                >
                  <Typography variant="body2" color="text.secondary">
                    {t('table.empty')}
                  </Typography>
                </TableCell>
              </MuiTableRow>
            ) : (
              table.getRowModel().rows.map((row, index) => (
                <MuiTableRow
                  key={row.id}
                  hover
                  selected={row.id === selectedRowId}
                  onClick={() => {
                    handleRowClick(row.id)
                  }}
                  onDoubleClick={(event) => {
                    openRow(row.id, event)
                  }}
                  sx={{ cursor: 'pointer', height: ROW_HEIGHT }}
                >
                  {showRowNumbers && (
                    <TableCell
                      sx={{ width: 48, textAlign: 'center', p: '4px 8px' }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {index + 1}
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
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </SearchHitCell>
                  ))}
                </MuiTableRow>
              ))
            )}
          </TableBody>
          {hasFooter && footerValues && (
            <TableFooter>
              {table.getFooterGroups().map((fg) => (
                <MuiTableRow key={fg.id}>
                  {showRowNumbers && <TableCell />}
                  {fg.headers.map((header) => {
                    const footerId = header.column.columnDef.footer
                    const footerText =
                      typeof footerId === 'string' &&
                      footerValues[footerId] !== undefined
                        ? renderCellValue(footerValues[footerId])
                        : ''
                    return (
                      <TableCell key={header.id} colSpan={header.colSpan}>
                        {footerText ? (
                          <Typography variant="body2" fontWeight="bold">
                            {footerText}
                          </Typography>
                        ) : null}
                      </TableCell>
                    )
                  })}
                </MuiTableRow>
              ))}
            </TableFooter>
          )}
        </Table>
      </TableContainer>
    </div>
  )
}
