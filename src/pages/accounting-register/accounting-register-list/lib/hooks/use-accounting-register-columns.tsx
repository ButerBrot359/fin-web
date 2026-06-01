import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import type { DocumentAttribute } from '@/entities/document-type'
import { formatCellValue } from '@/shared/lib/utils/format-cell-value'
import { formatDate } from '@/shared/lib/utils/date'
import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'

import type { AccountingRegisterEntry } from '../../types/accounting-register'

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

export const useAccountingRegisterColumns = (
  attributes: DocumentAttribute[]
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

    return [
      periodColumn,
      debitAccountColumn,
      creditAccountColumn,
      sumColumn,
      contentColumn,
      recorderColumn,
      lineNoColumn,
      ...attributeColumns,
    ]
  }, [attributes, i18n.language, t])
}
