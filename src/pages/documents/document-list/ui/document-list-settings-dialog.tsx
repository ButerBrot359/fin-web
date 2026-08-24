import { useMemo, useState } from 'react'
import { Dialog } from '@mui/material'
import type { SortingState, VisibilityState } from '@tanstack/react-table'

import { useTableFilters, useTableFilterStore } from '@/features/table-filter'
import type { ColumnMetaDto, FilterCondition } from '@/shared/lib/eav'
import CrossIcon from '@/shared/assets/icons/cross.svg'
import { Button } from '@/shared/ui/buttons'

type SettingsTab = 'basic' | 'filter' | 'sorting' | 'formatting' | 'grouping'

interface DocumentListSettingsDialogProps {
  open: boolean
  tableId: string
  columns: ColumnMetaDto[]
  columnVisibility: VisibilityState
  sorting: SortingState
  onClose: () => void
  onColumnVisibilityChange: (next: VisibilityState) => void
  onSortingChange: (next: SortingState) => void
}

const tabs: { id: SettingsTab; label: string }[] = [
  { id: 'basic', label: 'Основные' },
  { id: 'filter', label: 'Отбор' },
  { id: 'sorting', label: 'Сортировка' },
  { id: 'formatting', label: 'Условное оформление' },
  { id: 'grouping', label: 'Группировка' },
]

/**
 * 1C-style settings surface for a document list. The controls that the
 * current list transport can express (columns, filters, one sort) are applied
 * immediately; unsupported server-side presentation settings remain visibly
 * separated rather than pretending to alter the data.
 */
export const DocumentListSettingsDialog = ({
  open,
  tableId,
  columns,
  columnVisibility,
  sorting,
  onClose,
  onColumnVisibilityChange,
  onSortingChange,
}: DocumentListSettingsDialogProps) => {
  const [tab, setTab] = useState<SettingsTab>('basic')
  const filters = useTableFilters(tableId)
  const clearAll = useTableFilterStore((state) => state.clearAll)
  const removeFilter = useTableFilterStore((state) => state.removeFilter)

  const configurableColumns = useMemo(
    () => columns.filter((column) => column.code !== 'isPosted'),
    [columns]
  )

  const setColumnVisible = (code: string, visible: boolean) => {
    onColumnVisibilityChange({ ...columnVisibility, [code]: visible })
  }

  const isColumnVisible = (code: string): boolean => {
    const visibility: Record<string, boolean> = columnVisibility
    return visibility[code] ?? true
  }

  const formatFilterValue = (value: unknown): string => {
    if (value == null) return ''
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value)
    }
    return '…'
  }

  const sortId = sorting[0]?.id ?? ''
  const sortDesc = sorting[0]?.desc ?? false

  const setSort = (id: string, desc = sortDesc) => {
    onSortingChange(id ? [{ id, desc }] : [])
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      aria-labelledby="document-list-settings-title"
      slotProps={{
        paper: { sx: { minWidth: 760, maxWidth: 920, borderRadius: 4 } },
      }}
    >
      <div className="flex min-h-125 flex-col p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="document-list-settings-title"
            className="text-xl font-semibold text-ui-06"
          >
            Настройка списка
          </h2>
          <button type="button" aria-label="Закрыть" onClick={onClose}>
            <CrossIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex gap-1 border-b border-ui-04" role="tablist">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={`px-3 py-2 text-sm ${tab === item.id ? 'border-b-2 border-accent-02 font-medium text-accent-02' : 'text-ui-05'}`}
              onClick={() => {
                setTab(item.id)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-70 flex-1 text-sm text-ui-06">
          {tab === 'basic' && (
            <div className="grid grid-cols-2 gap-3">
              {configurableColumns.map((column) => (
                <label key={column.code} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isColumnVisible(column.code)}
                    onChange={(event) => {
                      setColumnVisible(column.code, event.target.checked)
                    }}
                  />
                  {column.nameRu}
                </label>
              ))}
            </div>
          )}

          {tab === 'filter' && (
            <div className="flex flex-col gap-3">
              <p>Активные отборы из заголовков списка.</p>
              {filters.length === 0 ? (
                <p className="text-ui-05">Отборы не заданы.</p>
              ) : (
                filters.map((filter: FilterCondition) => (
                  <div
                    key={filter.field}
                    className="flex items-center justify-between rounded bg-ui-01 px-3 py-2"
                  >
                    <span>
                      {filter.field} · {filter.op} ·{' '}
                      {formatFilterValue(filter.value)}
                    </span>
                    <Button
                      size="small"
                      variant="tertiary"
                      onClick={() => {
                        removeFilter(tableId, filter.field)
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                ))
              )}
              <div>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={filters.length === 0}
                  onClick={() => {
                    clearAll(tableId)
                  }}
                >
                  Очистить отборы
                </Button>
              </div>
            </div>
          )}

          {tab === 'sorting' && (
            <div className="flex max-w-md flex-col gap-3">
              <label className="flex flex-col gap-1">
                Поле
                <select
                  value={sortId}
                  className="rounded border border-ui-04 bg-white p-2"
                  onChange={(event) => {
                    setSort(event.target.value)
                  }}
                >
                  <option value="">Без сортировки</option>
                  {configurableColumns.map((column) => (
                    <option key={column.code} value={column.code}>
                      {column.nameRu}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                Направление
                <select
                  value={sortDesc ? 'DESC' : 'ASC'}
                  disabled={!sortId}
                  className="rounded border border-ui-04 bg-white p-2"
                  onChange={(event) => {
                    setSort(sortId, event.target.value === 'DESC')
                  }}
                >
                  <option value="ASC">По возрастанию</option>
                  <option value="DESC">По убыванию</option>
                </select>
              </label>
            </div>
          )}

          {tab === 'formatting' && (
            <p className="text-ui-05">
              Условное оформление требует серверного правила отображения;
              текущий список его ещё не передаёт.
            </p>
          )}

          {tab === 'grouping' && (
            <p className="text-ui-05">
              Группировка требует группированного источника данных. Текущий
              endpoint Табеля возвращает плоский список, поэтому настройка не
              подменяет данные локально.
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onClose}>
            Готово
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
