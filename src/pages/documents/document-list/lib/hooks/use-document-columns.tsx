import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentEntry } from '@/entities/document-entry'
import type { DocumentAttribute } from '@/entities/document-type'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import DocPostedIcon from '@/shared/assets/icons/doc-posted.svg'
import DocDraftIcon from '@/shared/assets/icons/doc-draft.svg'
import DocDeletedIcon from '@/shared/assets/icons/doc-deleted.svg'

const StatusIcon = ({ entry }: { entry: DocumentEntry }) => {
  if (entry.isPosted) return <DocPostedIcon className="h-4 w-4 shrink-0" />
  if (entry.isActive) return <DocDraftIcon className="h-4 w-4 shrink-0" />
  return <DocDeletedIcon className="h-4 w-4 shrink-0" />
}

const CellText = ({ children }: { children: React.ReactNode }) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {children}
  </Typography>
)

const buildAttributeColumns = (
  attributes: DocumentAttribute[],
  language: string
): ColumnDef<DocumentEntry>[] =>
  [...attributes]
    .filter((attr) => attr.showInList)
    .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
    .map((attr) => ({
      id: attr.code,
      accessorFn: (row: DocumentEntry) => row.attributes[attr.code],
      header: () => <span>{getLocalizedName(attr, language)}</span>,
      cell: ({ getValue }: { getValue: () => unknown }) => (
        <CellText>{formatCellValue(getValue(), attr)}</CellText>
      ),
    }))

export const useDocumentColumns = (
  attributes: DocumentAttribute[]
): ColumnDef<DocumentEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const statusColumn: ColumnDef<DocumentEntry> = {
      id: 'status',
      header: () => null,
      size: 24,
      cell: ({ row }) => <StatusIcon entry={row.original} />,
    }

    const nameColumn: ColumnDef<DocumentEntry> = {
      id: 'nameRu',
      accessorFn: (row) => getLocalizedName(row, i18n.language),
      header: () => <span>{t('documentTable.link')}</span>,
      cell: (info) => <CellText>{info.getValue() as string}</CellText>,
    }

    return [
      statusColumn,
      ...buildAttributeColumns(attributes, i18n.language),
      nameColumn,
    ]
  }, [attributes, i18n.language, t])
}
