import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import type { DictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import FolderIcon from '@/shared/assets/icons/folder-icon.svg'
import ListElementIcon from '@/shared/assets/icons/list-element-icon.svg'
import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

const buildAttributeColumns = (
  attributes: DocumentAttribute[],
  language: string
): ColumnDef<DictEntry>[] =>
  [...attributes]
    .filter((attr) => attr.showInList)
    .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
    .map((attr) => ({
      id: attr.code,
      accessorFn: (row: DictEntry) => row.attributes?.[attr.code],
      header: () => <span>{getLocalizedName(attr, language)}</span>,
      cell: ({ getValue }: { getValue: () => unknown }) =>
        cellText(formatCellValue(getValue(), attr)),
    }))

export const useDictionaryColumns = (
  attributes: DocumentAttribute[],
  isHierarchical?: boolean,
  depth?: number
): ColumnDef<DictEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const attrColumns = buildAttributeColumns(attributes, i18n.language)

    if (isHierarchical) {
      const indent = (depth ?? 0) * 24

      const hierarchyColumn: ColumnDef<DictEntry> = {
        id: '__hierarchy',
        header: () => null,
        size: 40 + indent,
        enableSorting: false,
        cell: ({ row: tableRow }) => {
          const entry = tableRow.original
          return (
            <div
              className="flex items-center gap-1"
              style={{ paddingLeft: indent }}
            >
              {entry.isGroup ? (
                <>
                  <ArrowDownIcon className="h-3 w-3 shrink-0 -rotate-90" />
                  <FolderIcon className="h-4 w-4 shrink-0" />
                </>
              ) : (
                <ListElementIcon className="h-4 w-4 shrink-0" />
              )}
            </div>
          )
        },
      }

      const nameColumn: ColumnDef<DictEntry> = {
        id: 'nameRu',
        accessorFn: (row) => getLocalizedName(row, i18n.language),
        header: () => <span>{t('documentTable.link')}</span>,
        cell: (info) => cellText(info.getValue() as string),
      }

      return [hierarchyColumn, ...attrColumns, nameColumn]
    }

    const nameColumn: ColumnDef<DictEntry> = {
      id: 'nameRu',
      accessorFn: (row) => getLocalizedName(row, i18n.language),
      header: () => <span>{t('documentTable.link')}</span>,
      cell: (info) => cellText(info.getValue() as string),
    }

    return [...attrColumns, nameColumn]
  }, [attributes, i18n.language, t, isHierarchical, depth])
}
