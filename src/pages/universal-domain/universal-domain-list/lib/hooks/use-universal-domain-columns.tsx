import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type { UniversalDomainEntry } from '../../types/universal-domain'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

/**
 * Колонки списка строятся строго по атрибутам типа (`showInList` +
 * `tableSortOrder`). Универсальный домен не имеет доменно-специфичных
 * системных колонок — поэтому здесь только атрибуты.
 */
export const useUniversalDomainColumns = (
  attributes: DocumentAttribute[]
): ColumnDef<UniversalDomainEntry>[] => {
  const { i18n } = useTranslation()

  return useMemo(
    () =>
      [...attributes]
        .filter((attr) => attr.showInList)
        .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
        .map((attr) => ({
          id: attr.code,
          accessorFn: (row: UniversalDomainEntry) => row.attributes?.[attr.code],
          header: () => <span>{getLocalizedName(attr, i18n.language)}</span>,
          cell: ({ getValue }: { getValue: () => unknown }) =>
            cellText(formatCellValue(getValue(), attr)),
        })),
    [attributes, i18n.language]
  )
}
