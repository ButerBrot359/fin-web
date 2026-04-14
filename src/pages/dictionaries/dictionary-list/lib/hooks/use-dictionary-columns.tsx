import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import type { DictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

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
  attributes: DocumentAttribute[]
): ColumnDef<DictEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const nameColumn: ColumnDef<DictEntry> = {
      id: 'nameRu',
      accessorFn: (row) => getLocalizedName(row, i18n.language),
      header: () => <span>{t('documentTable.link')}</span>,
      cell: (info) => cellText(info.getValue() as string),
    }

    return [...buildAttributeColumns(attributes, i18n.language), nameColumn]
  }, [attributes, i18n.language, t])
}
