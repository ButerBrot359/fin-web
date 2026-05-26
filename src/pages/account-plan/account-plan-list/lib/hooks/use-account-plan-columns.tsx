import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type { AccountPlanEntry } from '../../types/account-plan'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

export const useAccountPlanColumns = (
  attributes: DocumentAttribute[]
): ColumnDef<AccountPlanEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const codeColumn: ColumnDef<AccountPlanEntry> = {
      id: 'code',
      accessorFn: (row) => row.code ?? null,
      header: () => <span>{t('accountPlan.code')}</span>,
      cell: ({ getValue }) => cellText((getValue() as string | null) ?? ''),
    }

    const nameColumn: ColumnDef<AccountPlanEntry> = {
      id: 'nameRu',
      accessorFn: (row) => getLocalizedName(row, i18n.language),
      header: () => <span>{t('accountPlan.name')}</span>,
      cell: (info) => cellText(info.getValue() as string),
    }

    const attributeColumns: ColumnDef<AccountPlanEntry>[] = [...attributes]
      .filter((attr) => attr.showInList)
      .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
      .map((attr) => ({
        id: attr.code,
        accessorFn: (row: AccountPlanEntry) => row.attributes?.[attr.code],
        header: () => <span>{getLocalizedName(attr, i18n.language)}</span>,
        cell: ({ getValue }: { getValue: () => unknown }) =>
          cellText(formatCellValue(getValue(), attr)),
      }))

    return [codeColumn, nameColumn, ...attributeColumns]
  }, [attributes, i18n.language, t])
}
