import { useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { CircularProgress } from '@mui/material'

import ArrowRightIcon from '@/shared/assets/icons/arrow-right-small-blue.svg'
import FolderIcon from '@/shared/assets/icons/folder-icon.svg'
import { cn } from '@/shared/lib/utils/cn'

import type { DictSidebarPanel } from '../types/dict-sidebar'
import type { DictColumn } from '../lib/utils/dict-columns'
import { fetchDictEntriesPaged, type DictEntry } from '../api/dict-sidebar-api'

/** Догружаем узлы порциями; для пикера этого хватает без бесконечного скролла. */
const PAGE_SIZE = 100
const INDENT = 18

interface DictTreeProps {
  panel: DictSidebarPanel
  columns: DictColumn[]
  selectedId: number | null
  onSelectRow: (entry: DictEntry) => void
  onConfirm: () => void
  widthOf: (columnId: string) => number
  startResize: (columnId: string, event: ReactMouseEvent) => void
}

/**
 * Древовидный диалог «Показать все» для иерархических справочников (эталон 1С).
 * Корень грузится `/paged` без `parent` (группы + записи корня), дети группы —
 * лениво тем же эндпоинтом с `?parent={id}`. Листья выбираются, группы
 * разворачиваются. Серверные фильтры поля (`panel.searchParams`, напр. `af=`)
 * прокидываются на каждый уровень.
 */
export const DictTree = ({
  panel,
  columns,
  selectedId,
  onSelectRow,
  onConfirm,
  widthOf,
  startResize,
}: DictTreeProps) => {
  const { t } = useTranslation()
  const totalWidth = columns.reduce((sum, col) => sum + widthOf(col.id), 0)

  return (
    <div className="min-h-0 flex-1 overflow-auto pb-2">
      <table style={{ tableLayout: 'fixed', width: totalWidth, minWidth: '100%' }}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.id} style={{ width: widthOf(col.id) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                className="sticky top-0 z-10 bg-white px-3 py-2 text-left text-body2 font-medium text-ui-06 whitespace-nowrap border-b-2 border-ui-06 relative select-none"
              >
                <span className="block truncate">{col.title}</span>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onMouseDown={(e) => startResize(col.id, e)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-ui-04"
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <DictTreeLevel
            panel={panel}
            columns={columns}
            depth={0}
            selectedId={selectedId}
            onSelectRow={onSelectRow}
            onConfirm={onConfirm}
            emptyLabel={t('dictSidebar.noData')}
            loadMoreLabel={t('actions.more')}
          />
        </tbody>
      </table>
    </div>
  )
}

interface LevelProps {
  panel: DictSidebarPanel
  columns: DictColumn[]
  parentId?: number
  depth: number
  selectedId: number | null
  onSelectRow: (entry: DictEntry) => void
  onConfirm: () => void
  emptyLabel: string
  loadMoreLabel: string
}

/** Один уровень дерева: грузит записи под `parentId` (или корень) порциями. */
const DictTreeLevel = ({
  panel,
  columns,
  parentId,
  depth,
  selectedId,
  onSelectRow,
  onConfirm,
  emptyLabel,
  loadMoreLabel,
}: LevelProps) => {
  const [size, setSize] = useState(PAGE_SIZE)

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: [
      'dict-tree-level',
      panel.domain,
      panel.typeCode,
      parentId ?? 'root',
      size,
      panel.searchParams,
    ],
    queryFn: ({ signal }) =>
      fetchDictEntriesPaged(
        panel.domain,
        panel.typeCode,
        {
          page: 0,
          size,
          ...(parentId != null && { parent: parentId }),
          ...panel.searchParams,
        },
        signal
      ),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  })

  const paged = data?.data.data
  const entries = paged?.content ?? []
  const colSpan = columns.length

  if (isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-3 py-2" style={{ paddingLeft: depth * INDENT + 12 }}>
          <CircularProgress size={14} />
        </td>
      </tr>
    )
  }

  if (entries.length === 0) {
    // Корень без записей показываем как «нет данных»; пустую группу — молча.
    if (parentId != null) return null
    return (
      <tr>
        <td colSpan={colSpan} className="px-3 py-8 text-center text-ui-05">
          {emptyLabel}
        </td>
      </tr>
    )
  }

  return (
    <>
      {entries.map((entry) => (
        <DictTreeNode
          key={entry.id}
          panel={panel}
          columns={columns}
          entry={entry}
          depth={depth}
          selectedId={selectedId}
          onSelectRow={onSelectRow}
          onConfirm={onConfirm}
          emptyLabel={emptyLabel}
          loadMoreLabel={loadMoreLabel}
        />
      ))}
      {paged && !paged.last && (
        <tr>
          <td colSpan={colSpan} className="px-3 py-1" style={{ paddingLeft: depth * INDENT + 12 }}>
            <button
              type="button"
              className="text-body2 text-primary hover:underline disabled:opacity-50"
              disabled={isPlaceholderData}
              onClick={() => setSize((s) => s + PAGE_SIZE)}
            >
              {loadMoreLabel}
            </button>
          </td>
        </tr>
      )}
    </>
  )
}

interface NodeProps extends Omit<LevelProps, 'parentId'> {
  entry: DictEntry
}

/** Строка узла: группа разворачивается, лист — выбирается. */
const DictTreeNode = ({
  panel,
  columns,
  entry,
  depth,
  selectedId,
  onSelectRow,
  onConfirm,
  emptyLabel,
  loadMoreLabel,
}: NodeProps) => {
  const [expanded, setExpanded] = useState(false)
  const isGroup = !!entry.isGroup
  const isSelected = selectedId === entry.id

  const handleRowClick = () => {
    if (isGroup) {
      setExpanded((v) => !v)
    } else {
      onSelectRow(entry)
    }
  }

  return (
    <>
      <tr
        onClick={handleRowClick}
        onDoubleClick={() => {
          if (!isGroup) onConfirm()
        }}
        className={cn(
          'cursor-pointer transition-colors hover:bg-ui-07',
          isSelected && 'bg-ui-07'
        )}
      >
        {columns.map((col, colIndex) => (
          <td key={col.id} className="truncate px-3 py-2">
            {colIndex === 0 ? (
              <span
                className="flex items-center gap-1"
                style={{ paddingLeft: depth * INDENT }}
              >
                {isGroup ? (
                  <ArrowRightIcon
                    className={cn(
                      'h-3 w-3 shrink-0 transition-transform',
                      expanded && 'rotate-90'
                    )}
                  />
                ) : (
                  <span className="inline-block h-3 w-3 shrink-0" />
                )}
                {isGroup && <FolderIcon className="h-4 w-4 shrink-0" />}
                <span className="truncate">{col.render(entry)}</span>
              </span>
            ) : (
              col.render(entry)
            )}
          </td>
        ))}
      </tr>
      {isGroup && expanded && (
        <DictTreeLevel
          panel={panel}
          columns={columns}
          parentId={entry.id}
          depth={depth + 1}
          selectedId={selectedId}
          onSelectRow={onSelectRow}
          onConfirm={onConfirm}
          emptyLabel={emptyLabel}
          loadMoreLabel={loadMoreLabel}
        />
      )}
    </>
  )
}
