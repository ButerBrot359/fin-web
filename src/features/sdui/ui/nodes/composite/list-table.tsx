// SCRUM-291: тело таблицы LIST (loading/error/empty-состояния, thead/tbody
// виртуализированных строк, инфинит-скролл сентинел, футер с счётчиком
// загруженных строк) — вынесено из list-node.tsx (split на файлы < 300
// строк). Логика перенесена verbatim, без изменения поведения.
import type { FC, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { CircularProgress, Typography } from '@mui/material'
import { flexRender, type Table } from '@tanstack/react-table'
import type { Virtualizer } from '@tanstack/react-virtual'
import { cn } from '@/shared/lib/utils/cn'
import { resolveLoadedCountLabel } from './list-loaded-count'
import { ColumnResizeHandle } from './column-resize-handle'
import type { ListRow } from './list-column-defs'

interface ListTablePagedData {
  pages: { data: { totalElements?: number } }[]
}

type ListTableAction = { command?: string } | undefined

export interface ListTableProps {
  table: Table<ListRow>
  /** Бэк разрешил тянуть границы (`columnsResizable`) — фиксируем ширины и рисуем ручки. */
  isResizable: boolean
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>
  scrollRef: RefObject<HTMLDivElement | null>
  sentinelRef: RefObject<HTMLDivElement | null>
  rows: ListRow[]
  isLoading: boolean
  isError: boolean
  isFetchingNextPage: boolean
  pagedData: ListTablePagedData | undefined
  selectedRowId: number | null
  setSelectedRowId: (id: number) => void
  activateAction: ListTableAction
  selectAction: ListTableAction
  dispatchSelect: (action: ListTableAction, rowId: number) => void
}

export const ListTable: FC<ListTableProps> = ({
  table,
  isResizable,
  rowVirtualizer,
  scrollRef,
  sentinelRef,
  rows,
  isLoading,
  isError,
  isFetchingNextPage,
  pagedData,
  selectedRowId,
  setSelectedRowId,
  activateAction,
  selectAction,
  dispatchSelect,
}) => {
  const { t } = useTranslation()

  const tableRows = table.getRowModel().rows
  const virtualRows = rowVirtualizer.getVirtualItems()
  const paddingTop = virtualRows[0]?.start ?? 0
  const paddingBottom =
    virtualRows.length > 0
      ? rowVirtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0)
      : 0

  return (
    <div className="relative min-h-0 flex-1 flex flex-col">
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Typography className="text-ui-05">{t('inputs.loading')}</Typography>
        </div>
      ) : isError ? (
        <div className="flex items-center justify-center py-20">
          <Typography className="text-ui-05">{t('table.loadError')}</Typography>
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Typography className="text-ui-05">
            {t('dictSidebar.noData')}
          </Typography>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pb-2">
            {/* Ресайз требует фиксированной раскладки: иначе браузер
                перераспределяет ширины по содержимому и перетаскивание не
                видно. Без columnsResizable раскладка остаётся прежней (w-full,
                auto), чтобы не менять вид уже работающих списков. */}
            <table
              className={cn('border-separate', !isResizable && 'w-full')}
              style={
                isResizable
                  ? {
                      borderSpacing: '2px',
                      tableLayout: 'fixed',
                      width: table.getTotalSize(),
                      minWidth: '100%',
                    }
                  : { borderSpacing: '2px' }
              }
            >
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        // sticky уже создаёт контекст позиционирования — ручке
                        // достаточно overflow-hidden, чтобы её не срезал текст.
                        className={cn(
                          'sticky top-0 z-10 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06 whitespace-nowrap border-b-2 border-ui-06',
                          isResizable && 'overflow-hidden'
                        )}
                        style={{ width: header.getSize() }}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                        {header.column.getCanResize() && (
                          <ColumnResizeHandle
                            isResizing={header.column.getIsResizing()}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {paddingTop > 0 && (
                  <tr>
                    <td style={{ height: paddingTop }} />
                  </tr>
                )}
                {virtualRows.map((virtualRow) => {
                  const row = tableRows[virtualRow.index]
                  const isSelected = selectedRowId === row.original.id

                  return (
                    <tr
                      key={row.id}
                      onClick={() => {
                        setSelectedRowId(row.original.id)
                      }}
                      onDoubleClick={() => {
                        dispatchSelect(
                          activateAction ?? selectAction,
                          row.original.id
                        )
                      }}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-ui-07',
                        isSelected
                          ? 'bg-ui-07'
                          : virtualRow.index % 2 === 1
                            ? 'bg-ui-01'
                            : ''
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="max-w-50 truncate px-3 py-2 first:rounded-l-md last:rounded-r-md"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {paddingBottom > 0 && (
                  <tr>
                    <td style={{ height: paddingBottom }} />
                  </tr>
                )}
              </tbody>
            </table>
            <div ref={sentinelRef} className="h-1" />
          </div>

          <div className="shrink-0 px-3 py-2 flex items-center gap-2">
            <Typography variant="body2" className="text-ui-05">
              {resolveLoadedCountLabel(
                t,
                rows.length,
                pagedData?.pages[0]?.data.totalElements
              )}
            </Typography>
            {isFetchingNextPage && <CircularProgress size={14} />}
          </div>
        </>
      )}
    </div>
  )
}
