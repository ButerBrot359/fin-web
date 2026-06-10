import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import type { ColumnMetaDto } from '@/shared/lib/eav'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type { InformationRegisterEntry } from '../../types/information-register'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

export const useInformationRegisterColumns = (
  attributes: DocumentAttribute[],
  columnsMeta: ColumnMetaDto[] = []
): ColumnDef<InformationRegisterEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const periodColumn: ColumnDef<InformationRegisterEntry> = {
      id: 'period',
      accessorFn: (row) => row.period ?? null,
      header: () => <span>{t('informationRegister.period')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as string | null | undefined
        return cellText(v ? formatDate(v) : '')
      },
    }

    const recorderColumn: ColumnDef<InformationRegisterEntry> = {
      id: 'recorderDocumentEntryId',
      accessorFn: (row) => row.recorderDocumentEntryId ?? null,
      header: () => <span>{t('informationRegister.recorder')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as number | null | undefined
        return cellText(v == null ? '' : `#${String(v)}`)
      },
    }

    const attributeColumns: ColumnDef<InformationRegisterEntry>[] = [
      ...attributes,
    ]
      .filter((attr) => attr.showInList)
      .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
      .map((attr) => ({
        id: attr.code,
        accessorFn: (row: InformationRegisterEntry) =>
          row.attributes?.[attr.code],
        header: () => <span>{getLocalizedName(attr, i18n.language)}</span>,
        cell: ({ getValue }: { getValue: () => unknown }) =>
          cellText(formatCellValue(getValue(), attr)),
      }))

    // Системные колонки рендерим только если бэкенд вернул их в /columns.
    // Так разные типы регистров (например NastroykaMemorialnykhOrderov vs
    // NastroykaZapolneniyaStateyDDS) получают свой набор системных колонок.
    const metaCodes = new Set(columnsMeta.map((c) => c.code))
    const systemColumns: ColumnDef<InformationRegisterEntry>[] = []
    if (metaCodes.has('period')) systemColumns.push(periodColumn)
    if (metaCodes.has('recorderDocumentEntryId')) {
      systemColumns.push(recorderColumn)
    }

    return [...systemColumns, ...attributeColumns]
  }, [attributes, columnsMeta, i18n.language, t])
}
