import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CircularProgress, Tooltip, Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentEntry } from '@/entities/document-entry'
import type { DocumentAttribute } from '@/entities/document-type'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import DocPostedIcon from '@/shared/assets/icons/doc-posted.svg'
import DocDraftIcon from '@/shared/assets/icons/doc-draft.svg'
import DocDeletedIcon from '@/shared/assets/icons/doc-deleted.svg'

const StatusIcon = ({
  entry,
  posting,
}: {
  entry: DocumentEntry
  posting?: boolean
}) => {
  const { t } = useTranslation()
  // SCRUM-330: по записи идёт фоновое проведение — крутящийся индикатор
  // вместо статуса, с подсказкой; статусные значки вернутся, когда задача
  // завершится и активный опрос перестанет отдавать эту запись
  if (posting) {
    return (
      <Tooltip title={t('documentTable.postingInProgress')}>
        <CircularProgress size={16} thickness={5} className="shrink-0" />
      </Tooltip>
    )
  }
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

interface DocumentColumnsOptions {
  /** SCRUM-276 §3.2: явный 1С-порядок кодов атрибутов; неизвестные — после. */
  columnOrder?: string[]
  /** SCRUM-276 §3.2: скрыть статус-колонку («Проведён» вне эталона 1С). */
  hideStatus?: boolean
  /** SCRUM-330: записи с идущим фоновым проведением — спиннер вместо статуса. */
  postingEntryIds?: Set<number>
}

const orderIndex = (order: string[], code: string): number => {
  const idx = order.indexOf(code)
  return idx === -1 ? order.length : idx
}

export const useDocumentColumns = (
  attributes: DocumentAttribute[],
  options?: DocumentColumnsOptions
): ColumnDef<DocumentEntry>[] => {
  const { t, i18n } = useTranslation()
  const { columnOrder, hideStatus, postingEntryIds } = options ?? {}

  return useMemo(() => {
    const statusColumn: ColumnDef<DocumentEntry> = {
      id: 'status',
      // Иконка фильтра должна смотреть на бэкендовое поле `isPosted`,
      // хотя визуально это колонка статуса со значками posted/draft/deleted.
      meta: { metaCode: 'isPosted' },
      header: () => null,
      size: 24,
      enableSorting: false,
      cell: ({ row }) => (
        <StatusIcon
          entry={row.original}
          posting={postingEntryIds?.has(row.original.id)}
        />
      ),
    }

    const nameColumn: ColumnDef<DocumentEntry> = {
      id: 'nameRu',
      accessorFn: (row) => getLocalizedName(row, i18n.language),
      header: () => <span>{t('documentTable.link')}</span>,
      cell: (info) => <CellText>{info.getValue() as string}</CellText>,
    }

    let attributeColumns = buildAttributeColumns(attributes, i18n.language)
    if (columnOrder) {
      // Стабильная сортировка сохраняет metadata-порядок внутри «неизвестных»
      attributeColumns = [...attributeColumns].sort(
        (a, b) =>
          orderIndex(columnOrder, a.id ?? '') -
          orderIndex(columnOrder, b.id ?? '')
      )
    }

    return [
      ...(hideStatus ? [] : [statusColumn]),
      ...attributeColumns,
      nameColumn,
    ]
  }, [attributes, columnOrder, hideStatus, postingEntryIds, i18n.language, t])
}
