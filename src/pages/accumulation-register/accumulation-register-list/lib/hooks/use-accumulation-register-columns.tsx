import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type {
  AccumulationRegisterEntry,
  AccumulationRegisterMovementKind,
} from '../../types/accumulation-register'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

export const useAccumulationRegisterColumns = (
  attributes: DocumentAttribute[]
): ColumnDef<AccumulationRegisterEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const periodColumn: ColumnDef<AccumulationRegisterEntry> = {
      id: 'period',
      accessorFn: (row) => row.period ?? null,
      header: () => <span>{t('accumulationRegister.period')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as string | null | undefined
        return cellText(v ? formatDate(v) : '')
      },
    }

    const movementKindColumn: ColumnDef<AccumulationRegisterEntry> = {
      id: 'movementKind',
      accessorFn: (row) => row.movementKind ?? null,
      header: () => <span>{t('accumulationRegister.movementKind')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as AccumulationRegisterMovementKind | null | undefined
        return cellText(
          v == null ? '' : t(`accumulationRegister.movementKindValue.${v}`)
        )
      },
    }

    const recorderColumn: ColumnDef<AccumulationRegisterEntry> = {
      id: 'recorderDocumentEntryId',
      accessorFn: (row) => row.recorderDocumentEntryId ?? null,
      header: () => <span>{t('accumulationRegister.recorder')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as number | null | undefined
        return cellText(v == null ? '' : `#${String(v)}`)
      },
    }

    const lineNoColumn: ColumnDef<AccumulationRegisterEntry> = {
      id: 'lineNo',
      accessorFn: (row) => row.lineNo ?? null,
      header: () => <span>{t('accumulationRegister.lineNo')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as number | null | undefined
        return cellText(v == null ? '' : String(v))
      },
    }

    const attributeColumns: ColumnDef<AccumulationRegisterEntry>[] = [
      ...attributes,
    ]
      .filter((attr) => attr.showInList)
      .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
      .map((attr) => ({
        id: attr.code,
        accessorFn: (row: AccumulationRegisterEntry) =>
          row.attributes?.[attr.code],
        header: () => <span>{getLocalizedName(attr, i18n.language)}</span>,
        cell: ({ getValue }: { getValue: () => unknown }) =>
          cellText(formatCellValue(getValue(), attr)),
      }))

    return [
      periodColumn,
      movementKindColumn,
      recorderColumn,
      lineNoColumn,
      ...attributeColumns,
    ]
  }, [attributes, i18n.language, t])
}
