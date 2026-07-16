import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import { formatDate, formatDateTime } from '@/shared/lib/utils/date'
import { cn } from '@/shared/lib/utils/cn'

import type {
  MovementGroup,
  MovementColumnMeta,
} from '../api/document-movements-api'
import { deriveCreditDimensions } from '../lib/derive-credit-dimensions'
import { AccountingPostingsTable } from './accounting-postings-table'

/** Код регистра бухгалтерии — рендерится раскладкой 1С (Дебет/Кредит). */
const ACCOUNTING_REGISTER_CODE = 'ZhurnalProvodokGosUchrezhdeniya'

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
        // Период (1C: Period — DateTime) — дата со временем до секунд,
        // как в журнале регистра: различает движения внутри одного дня.
        return (
          <Typography variant="body2" noWrap className="text-ui-06">
            {typeof val === 'string'
              ? formatDate(val, 'dd.MM.yyyy HH:mm:ss')
              : ''}
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
              className={cn(
                'transition-colors hover:bg-ui-07',
                rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-ui-01'
              )}
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

/**
 * Вкладки движений документа по регистрам (одна вкладка = один регистр) +
 * таблица активной группы. Регистр бухгалтерии — раскладкой 1С (Дт/Кт),
 * остальные — плоской таблицей движений. Переиспользуется страницей
 * «Движения документа» (кнопка Дт/Кт формы) и отчётом «Движения документа»
 * (DvizheniyaDokumenta) — рендер один и тот же, различается только источник
 * данных.
 */
export const MovementGroupsView = ({ groups }: { groups: MovementGroup[] }) => {
  const { i18n } = useTranslation()

  // Кредитные значения измерений (напр. подразделение Кт = «расход») из
  // накопительного регистра того же ответа — accounting-группа их одним полем
  // (=Дт) не отдаёт. См. deriveCreditDimensions.
  const creditDimensions = useMemo(
    () => deriveCreditDimensions(groups),
    [groups]
  )
  const [activeTab, setActiveTab] = useState<string | null>(null)

  const currentTab =
    activeTab ?? (groups.length > 0 ? groups[0].registerTypeCode : null)

  const activeGroup = groups.find((g) => g.registerTypeCode === currentTab)

  return (
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

      {activeGroup &&
        (activeGroup.registerTypeCode === ACCOUNTING_REGISTER_CODE ? (
          <AccountingPostingsTable
            group={activeGroup}
            creditOverrides={creditDimensions}
          />
        ) : (
          <MovementTable group={activeGroup} />
        ))}
    </div>
  )
}
