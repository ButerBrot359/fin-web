import { useMemo, useState } from 'react'
import {
  useParams,
  useNavigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Typography } from '@mui/material'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'

import { useTabMeta, useWorkspaceTabsStore } from '@/features/workspace-tabs'
import { PageHeader } from '@/widgets/page-header'
import { DropdownButton } from '@/shared/ui/buttons'
import { PageSkeleton } from '@/shared/ui/page-skeleton/page-skeleton'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'
import { cn } from '@/shared/lib/utils/cn'

import {
  fetchDocumentMovements,
  type MovementGroup,
  type MovementColumnMeta,
} from '../api/document-movements-api'

const formatMovementCell = (
  value: unknown,
  column: MovementColumnMeta
): string => {
  if (value == null || value === '') return ''

  switch (column.dataType) {
    case 'DATE':
      return typeof value === 'string' ? formatDate(value) : ''
    case 'DATETIME':
      return typeof value === 'string' ? formatDateTime(value) : ''
    case 'BOOLEAN':
      return value === true ? 'Да' : 'Нет'
    default: {
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>
        const display =
          (obj.displayName as string | undefined) ??
          (obj.nameRu as string | undefined) ??
          (obj.name as string | undefined)
        return display ?? ''
      }
      return String(value as string | number)
    }
  }
}

const MovementTable = ({ group }: { group: MovementGroup }) => {
  const { i18n } = useTranslation()

  const sortedColumns = useMemo(
    () => [...group.columns].sort((a, b) => a.sortOrder - b.sortOrder),
    [group.columns]
  )

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const periodCol: ColumnDef<Record<string, unknown>> = {
      id: '_period',
      accessorKey: '_period',
      header: () => <span>{i18n.language === 'kz' ? 'Кезең' : 'Период'}</span>,
      cell: (info) => {
        const val = info.getValue()
        return (
          <Typography variant="body2" noWrap className="text-ui-06">
            {typeof val === 'string' ? formatDate(val) : ''}
          </Typography>
        )
      },
    }

    const numberCol: ColumnDef<Record<string, unknown>> = {
      id: '_rowNumber',
      header: () => <span>N</span>,
      cell: (info) => (
        <Typography variant="body2" noWrap className="text-ui-06">
          {info.row.index + 1}
        </Typography>
      ),
      size: 50,
    }

    const dataCols: ColumnDef<Record<string, unknown>>[] = sortedColumns.map(
      (col) => ({
        id: col.code,
        accessorKey: col.code,
        header: () => <span>{getLocalizedName(col, i18n.language)}</span>,
        cell: (info) => (
          <Typography variant="body2" noWrap className="text-ui-06">
            {formatMovementCell(info.getValue(), col)}
          </Typography>
        ),
      })
    )

    return [periodCol, numberCol, ...dataCols]
  }, [sortedColumns, i18n.language])

  const table = useReactTable({
    data: group.entries,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <table
        className="w-full border-separate"
        style={{ borderSpacing: '2px' }}
      >
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left text-body2 font-medium text-ui-06 whitespace-nowrap border-b-2 border-ui-06"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              className={rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-ui-01'}
            >
              {row.getVisibleCells().map((cell, cellIndex) => (
                <td
                  key={cell.id}
                  className={cn(
                    'px-3 py-2 max-w-60 truncate',
                    cellIndex === 0 && 'rounded-l-md',
                    cellIndex === row.getVisibleCells().length - 1 &&
                      'rounded-r-md'
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const DocumentMovementsPage = () => {
  const { entryId = '', pageCode = '', moduleCode = '' } = useParams()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const { data, isLoading } = useQuery({
    queryKey: ['document-movements', entryId],
    queryFn: ({ signal }) => fetchDocumentMovements(entryId, signal),
    select: (res) => res.data.data.groups,
  })

  const groups = data ?? []
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const currentTab =
    activeTab ?? (groups.length > 0 ? groups[0].registerTypeCode : null)

  const activeGroup = groups.find((g) => g.registerTypeCode === currentTab)

  const docTitle = searchParams.get('title')
  const movementsLabel = t('documentMovements.title')
  const pageTitle = docTitle ? `${movementsLabel}: ${docTitle}` : movementsLabel
  useTabMeta(pageTitle)

  const handleClose = () => {
    useWorkspaceTabsStore.getState().closeTab(location.pathname)
    void navigate(`/modules/${pageCode}/document/${moduleCode}/${entryId}`)
  }

  return (
    <div className="flex h-full flex-col gap-5 pt-5">
      <PageHeader title={pageTitle} onClose={handleClose} />

      <div className="flex items-center justify-end">
        <DropdownButton label={t('actions.more')} />
      </div>

      {isLoading ? (
        <PageSkeleton />
      ) : groups.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Typography className="text-ui-05">
            {t('documentMovements.empty')}
          </Typography>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          <div className="flex gap-1 border-b border-ui-03">
            {groups.map((group) => (
              <button
                key={group.registerTypeCode}
                type="button"
                onClick={() => {
                  setActiveTab(group.registerTypeCode)
                }}
                className={cn(
                  'cursor-pointer rounded-t-md px-4 py-2 text-body2 font-medium transition-colors',
                  currentTab === group.registerTypeCode
                    ? 'bg-ui-06 text-ui-01'
                    : 'bg-ui-01 text-ui-05 hover:bg-ui-07'
                )}
              >
                {getLocalizedName(
                  {
                    nameRu: group.registerTypeNameRu,
                    nameKz: group.registerTypeNameKz,
                  },
                  i18n.language
                )}
              </button>
            ))}
          </div>

          {activeGroup && <MovementTable group={activeGroup} />}
        </div>
      )}
    </div>
  )
}
