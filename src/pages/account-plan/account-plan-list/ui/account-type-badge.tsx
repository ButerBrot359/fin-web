import { useTranslation } from 'react-i18next'

import type { AccountType } from '@/entities/account-plan'

const COLOR_BY_TYPE: Record<AccountType, string> = {
  A: 'bg-blue-100 text-blue-700',
  P: 'bg-red-100 text-red-700',
  AP: 'bg-purple-100 text-purple-700',
}

// `as const` сохраняет литеральный тип ключей t() (см. i18next.d.ts).
const LABEL_KEY_BY_TYPE = {
  A: 'accountPlan.accountType.active',
  P: 'accountPlan.accountType.passive',
  AP: 'accountPlan.accountType.activePassive',
} as const satisfies Record<AccountType, string>

interface AccountTypeBadgeProps {
  type: AccountType
}

export const AccountTypeBadge = ({ type }: AccountTypeBadgeProps) => {
  const { t } = useTranslation()
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${COLOR_BY_TYPE[type]}`}
    >
      {t(LABEL_KEY_BY_TYPE[type])}
    </span>
  )
}
