import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import type { ColumnMetaDto } from '@/shared/lib/eav'
import { REFERENCE_DOMAIN_KINDS } from '@/shared/lib/consts/data-types'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type { AccountingRegisterEntry } from '../../types/accounting-register'
import { DimensionCell } from '../../ui/dimension-cell'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

/**
 * Системные коды, для которых уже есть отдельные жёсткие колонки выше —
 * чтобы не дублировать их generic-колонками измерений из `/columns`.
 */
const HARDCODED_SYSTEM_CODES = new Set([
  'period',
  'accountDtId',
  'accountKtId',
  'summa',
  'soderzhanie',
  'recorderDocumentEntryId',
  'lineNo',
  'isActive',
  // Валюта доступна системными полями valyutaDtId/valyutaKtId — в гриде не рисуем.
  'valyutaDtId',
  'valyutaKtId',
])

export const useAccountingRegisterColumns = (
  attributes: DocumentAttribute[],
  columnsMeta: ColumnMetaDto[] = []
): ColumnDef<AccountingRegisterEntry>[] => {
  const { t, i18n } = useTranslation()

  return useMemo(() => {
    const periodColumn: ColumnDef<AccountingRegisterEntry> = {
      id: 'period',
      accessorFn: (row) => row.period ?? null,
      header: () => <span>{t('accountingRegister.period')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as string | null | undefined
        return cellText(v ? formatDate(v) : '')
      },
    }

    // id = системный код фильтра/сортировки (accountDtId), но отображаем
    // читаемый код счёта (accountDtCode) — бэк whitelist'ит фильтр по *Id.
    const debitAccountColumn: ColumnDef<AccountingRegisterEntry> = {
      id: 'accountDtId',
      accessorFn: (row) => row.accountDtCode ?? null,
      header: () => <span>{t('accountingRegister.debitAccount')}</span>,
      cell: ({ getValue }) => cellText((getValue() as string | null) ?? ''),
    }

    const creditAccountColumn: ColumnDef<AccountingRegisterEntry> = {
      id: 'accountKtId',
      accessorFn: (row) => row.accountKtCode ?? null,
      header: () => <span>{t('accountingRegister.creditAccount')}</span>,
      cell: ({ getValue }) => cellText((getValue() as string | null) ?? ''),
    }

    const sumColumn: ColumnDef<AccountingRegisterEntry> = {
      id: 'summa',
      accessorFn: (row) => row.summa ?? null,
      header: () => <span>{t('accountingRegister.sum')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as number | string | null | undefined
        return cellText(v == null ? '' : String(v))
      },
    }

    const contentColumn: ColumnDef<AccountingRegisterEntry> = {
      id: 'soderzhanie',
      accessorFn: (row) => row.soderzhanie ?? null,
      header: () => <span>{t('accountingRegister.content')}</span>,
      cell: ({ getValue }) => cellText((getValue() as string | null) ?? ''),
    }

    const recorderColumn: ColumnDef<AccountingRegisterEntry> = {
      id: 'recorderDocumentEntryId',
      accessorFn: (row) => row.recorderDocumentEntryId ?? null,
      header: () => <span>{t('accountingRegister.recorder')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as number | null | undefined
        return cellText(v == null ? '' : `#${String(v)}`)
      },
    }

    const lineNoColumn: ColumnDef<AccountingRegisterEntry> = {
      id: 'lineNo',
      accessorFn: (row) => row.lineNo ?? null,
      header: () => <span>{t('accountingRegister.lineNo')}</span>,
      cell: ({ getValue }) => {
        const v = getValue() as number | null | undefined
        return cellText(v == null ? '' : String(v))
      },
    }

    const attributeColumns: ColumnDef<AccountingRegisterEntry>[] = [
      ...attributes,
    ]
      .filter((attr) => attr.showInList)
      .sort((a, b) => a.tableSortOrder - b.tableSortOrder)
      .map((attr) => ({
        id: attr.code,
        accessorFn: (row: AccountingRegisterEntry) => row.attributes?.[attr.code],
        header: () => <span>{getLocalizedName(attr, i18n.language)}</span>,
        cell: ({ getValue }: { getValue: () => unknown }) =>
          cellText(formatCellValue(getValue(), attr)),
      }))

    // Системные колонки-измерения (Организация/ФКР/Специфика/…) приходят
    // из `/columns`. Значение лежит прямо в строке: `row[col.code]` (ID).
    // Ссылочные (referencedDomainKind) резолвим ID → имя через справочник.
    const dimensionColumns: ColumnDef<AccountingRegisterEntry>[] = columnsMeta
      .filter(
        (col) => col.isSystem && !HARDCODED_SYSTEM_CODES.has(col.code)
      )
      .map((col) => {
        const isReference =
          !!col.referencedDomainKind &&
          REFERENCE_DOMAIN_KINDS.has(col.referencedDomainKind)
        return {
          id: col.code,
          accessorFn: (row: AccountingRegisterEntry) =>
            (row[col.code] as number | null | undefined) ?? null,
          header: () => (
            <span>{i18n.language === 'kz' ? col.nameKz ?? col.nameRu : col.nameRu}</span>
          ),
          cell: ({ getValue }: { getValue: () => unknown }) => (
            <DimensionCell
              id={getValue() as number | null | undefined}
              resolve={isReference}
            />
          ),
        }
      })

    return [
      periodColumn,
      debitAccountColumn,
      creditAccountColumn,
      sumColumn,
      contentColumn,
      recorderColumn,
      lineNoColumn,
      ...dimensionColumns,
      ...attributeColumns,
    ]
  }, [attributes, columnsMeta, i18n.language, t])
}
