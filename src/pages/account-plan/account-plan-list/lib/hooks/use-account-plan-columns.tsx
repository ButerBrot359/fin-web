import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Typography } from '@mui/material'
import type { ColumnDef } from '@tanstack/react-table'

import { getLocalizedName } from '@/shared/lib/utils/get-localized-name'
import FolderIcon from '@/shared/assets/icons/folder-icon.svg'
import ListElementIcon from '@/shared/assets/icons/list-element-icon.svg'
import ArrowDownIcon from '@/shared/assets/icons/arrow-down.svg'

import type { AccountPlanRow } from '../utils/build-tree-rows'
import { AccountTypeBadge } from '../../ui/account-type-badge'
import { BooleanMark } from '../../ui/boolean-mark'

interface UseAccountPlanColumnsParams {
  onToggleExpand: (id: number) => void
}

const cellText = (value: React.ReactNode) => (
  <Typography variant="body2" noWrap className="text-ui-06">
    {value}
  </Typography>
)

export const useAccountPlanColumns = ({
  onToggleExpand,
}: UseAccountPlanColumnsParams): ColumnDef<AccountPlanRow>[] => {
  const { t, i18n } = useTranslation()

  return useMemo<ColumnDef<AccountPlanRow>[]>(
    () => [
      {
        id: 'code',
        header: () => <span>{t('accountPlan.column.code')}</span>,
        size: 160,
        cell: ({ row }) => {
          const { entry, depth, hasChildren, isExpanded } = row.original
          return (
            <div
              className="flex items-center gap-1"
              style={{ paddingLeft: depth * 20 }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={
                    isExpanded
                      ? t('accountPlan.collapse')
                      : t('accountPlan.expand')
                  }
                  className="flex h-4 w-4 items-center justify-center"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleExpand(entry.id)
                  }}
                >
                  <ArrowDownIcon
                    className={`h-3 w-3 shrink-0 transition-transform ${
                      isExpanded ? '' : '-rotate-90'
                    }`}
                  />
                </button>
              ) : (
                <span className="h-4 w-4 shrink-0" />
              )}
              {entry.isGroup ? (
                <FolderIcon className="h-4 w-4 shrink-0" />
              ) : (
                <ListElementIcon className="h-4 w-4 shrink-0" />
              )}
              <span className="ml-1 text-ui-06">{entry.code}</span>
            </div>
          )
        },
      },
      {
        id: 'name',
        header: () => <span>{t('accountPlan.column.name')}</span>,
        accessorFn: (row) => getLocalizedName(row.entry, i18n.language),
        cell: ({ getValue }) => cellText(getValue() as string),
      },
      {
        id: 'fullNameKz',
        header: () => <span>{t('accountPlan.column.fullNameKz')}</span>,
        accessorFn: (row) => row.entry.nameKz ?? '',
        cell: ({ getValue }) => cellText((getValue() as string) || '—'),
      },
      // Виды субконто счёта (позиции 1/2/3), как в 1С.
      ...([1, 2, 3] as const).map((pos) => ({
        id: `subkonto${pos}`,
        header: () => <span>{t('accountPlan.column.subconto', { n: pos })}</span>,
        size: 160,
        accessorFn: (row: AccountPlanRow) => {
          const k = row.entry.subkontoKinds?.find((s) => s.position === pos)
          if (!k) return ''
          return i18n.language === 'kz'
            ? (k.kindNameKz ?? k.kindNameRu)
            : k.kindNameRu
        },
        cell: ({ getValue }: { getValue: () => unknown }) =>
          cellText((getValue() as string) || '—'),
      })),
      {
        id: 'accountType',
        header: () => <span>{t('accountPlan.column.accountType')}</span>,
        size: 130,
        cell: ({ row }) => (
          <AccountTypeBadge type={row.original.entry.accountType} />
        ),
      },
      {
        id: 'isCurrency',
        header: () => <span>{t('accountPlan.column.currency')}</span>,
        size: 90,
        cell: ({ row }) => (
          <BooleanMark value={row.original.entry.isCurrency} />
        ),
      },
      {
        id: 'isQuantity',
        header: () => <span>{t('accountPlan.column.quantitative')}</span>,
        size: 110,
        cell: ({ row }) => (
          <BooleanMark value={row.original.entry.isQuantity} />
        ),
      },
      {
        id: 'isOffBalance',
        header: () => <span>{t('accountPlan.column.offBalance')}</span>,
        size: 110,
        cell: ({ row }) => (
          <BooleanMark value={row.original.entry.isOffBalance} />
        ),
      },
      {
        id: 'nomerMo',
        header: () => <span>{t('accountPlan.column.nomerMo')}</span>,
        size: 110,
        accessorFn: (row) => row.entry.attributes.NomerMemorialnogoOrdera,
        cell: ({ getValue }) => {
          const value = getValue() as number | null | undefined
          return cellText(value ? String(value) : '—')
        },
      },
    ],
    [t, i18n.language, onToggleExpand]
  )
}
