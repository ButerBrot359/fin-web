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
 * Атрибутные колонки строятся по `showInList` + `tableSortOrder`. Атрибут
 * наименования (`code1C === 'Наименование'`) исключается: его значение
 * приходит не в `attributes`, а на верхнем уровне записи — он отрисовывается
 * отдельной колонкой-наименованием (см. ниже), как в Dictionary/Document.
 */
const buildAttributeColumns = (
  attributes: DocumentAttribute[],
  language: string
): ColumnDef<UniversalDomainEntry>[] =>
  [...attributes]
    .filter((attr) => attr.showInList && attr.code1C !== 'Наименование')
    .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
    .map((attr) => ({
      id: attr.code,
      accessorFn: (row: UniversalDomainEntry) => row.attributes?.[attr.code],
      header: () => <span>{getLocalizedName(attr, language)}</span>,
      cell: ({ getValue }: { getValue: () => unknown }) =>
        cellText(formatCellValue(getValue(), attr)),
    }))

/**
 * Колонки списка универсального домена. Повторяет схему Dictionary/Document:
 * атрибутные колонки по `showInList`, а затем отдельная колонка-наименование,
 * резолвящая имя записи через `getLocalizedName(row)` (бэк кладёт его на
 * верхний уровень записи, а не в `attributes`).
 */
export const useUniversalDomainColumns = (
  attributes: DocumentAttribute[]
): ColumnDef<UniversalDomainEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const nameColumn: ColumnDef<UniversalDomainEntry> = {
      id: 'nameRu',
      accessorFn: (row) => getLocalizedName(row, i18n.language),
      header: () => <span>{t('documentTable.link')}</span>,
      cell: (info) => cellText(info.getValue() as string),
    }

    return [...buildAttributeColumns(attributes, i18n.language), nameColumn]
  }, [attributes, i18n.language, t])
}
