import { Checkbox } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentEntry } from '@/entities/document-entry'

interface SelectionColumnArgs {
  selectedIds: ReadonlySet<number>
  /** Загруженные строки — область действия «выбрать все». */
  loadedIds: number[]
  onToggle: (id: number, checked: boolean) => void
  onToggleAll: (checked: boolean) => void
}

/**
 * Колонка мультивыбора для списка Табеля (spec v2 §3.2). Собирается на
 * странице и передаётся через обычный columns-проп — общий EavEntityTable
 * не меняется, списки других document types не затронуты.
 */
export const buildTabelSelectionColumn = ({
  selectedIds,
  loadedIds,
  onToggle,
  onToggleAll,
}: SelectionColumnArgs): ColumnDef<DocumentEntry> => {
  const allSelected =
    loadedIds.length > 0 && loadedIds.every((id) => selectedIds.has(id))
  const someSelected = loadedIds.some((id) => selectedIds.has(id))

  return {
    id: 'tabelSelect',
    size: 36,
    enableSorting: false,
    enableResizing: false,
    header: () => (
      <Checkbox
        size="small"
        sx={{ p: 0 }}
        checked={allSelected}
        indeterminate={someSelected && !allSelected}
        onChange={(e) => {
          onToggleAll(e.target.checked)
        }}
        onClick={(e) => {
          e.stopPropagation()
        }}
      />
    ),
    cell: ({ row }) => (
      // Обёртка на всю ячейку: промах на пару пикселей мимо чекбокса не
      // должен превращаться в клик по строке (сброс мультивыбора)
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '4px 6px' }}
        onClick={(e) => {
          e.stopPropagation()
        }}
        onDoubleClick={(e) => {
          e.stopPropagation()
        }}
      >
        <Checkbox
          size="small"
          sx={{ p: 0 }}
          checked={selectedIds.has(row.original.id)}
          onChange={(e) => {
            onToggle(row.original.id, e.target.checked)
          }}
        />
      </div>
    ),
  }
}
