import { useTranslation } from 'react-i18next'

import type { AccountType } from '@/entities/account-plan'

/**
 * Бейдж вида счёта: Активный — синий, Пассивный — красный, АП — фиолетовый.
 * Цвета берём из Tailwind-палитры; в Tailwind-конфиге проекта нет
 * семантических токенов «red/blue/purple», поэтому используем `bg-*-100`
 * и `text-*-700` из дефолтной палитры — единообразно и читаемо.
 */
const COLOR_BY_TYPE: Record<AccountType, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700',
  PASSIVE: 'bg-red-100 text-red-700',
  ACTIVE_PASSIVE: 'bg-purple-100 text-purple-700',
}

// `as const` — чтобы значения сохранили литеральный тип и совпали с
// strict-типизацией ключей `t()` из i18next.d.ts (иначе TS2345).
const LABEL_KEY_BY_TYPE = {
  ACTIVE: 'accountPlan.accountType.active',
  PASSIVE: 'accountPlan.accountType.passive',
  ACTIVE_PASSIVE: 'accountPlan.accountType.activePassive',
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
