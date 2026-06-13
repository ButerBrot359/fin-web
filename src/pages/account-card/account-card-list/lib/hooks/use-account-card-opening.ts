import { useQuery } from '@tanstack/react-query'

import { fetchAccountCardOpeningBalance } from '../../api/account-card-api'

const num = (v: number | string | null | undefined): number => {
  if (v == null || v === '') return 0
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isNaN(n) ? 0 : n
}

/**
 * Начальное сальдо счёта (signed = balanceDt − balanceKt) на дату `atDate`.
 * Для карточки счёта это остаток на начало периода.
 */
export const useAccountCardOpening = (
  atDate: string | null,
  accountId: number | undefined,
  enabled: boolean
) => {
  const { data } = useQuery({
    queryKey: ['account-card-opening', atDate, accountId ?? null],
    queryFn: ({ signal }) =>
      fetchAccountCardOpeningBalance(atDate!, accountId, signal),
    select: (res) => {
      const rows = res.data.list
      const row =
        accountId != null
          ? rows.find((r) => r.accountId === accountId)
          : rows[0]
      if (!row) return 0
      return num(row.balanceDt) - num(row.balanceKt)
    },
    enabled: enabled && !!atDate,
    staleTime: 60 * 1000,
  })

  return { opening: data ?? 0 }
}
