import type { AccountPlanCreatePayload } from '@/entities/account-plan'

import type { AccountPlanCardValue } from '../../ui/account-plan-card'

/** Маппинг карточного value -> payload для бэка (опускаем пустую nameKz). */
export const buildAccountPlanPayload = (
  v: AccountPlanCardValue
): AccountPlanCreatePayload => ({
  code: v.code,
  nameRu: v.nameRu,
  nameKz: v.nameKz || undefined,
  accountType: v.accountType,
  isCurrency: v.isCurrency,
  isQuantitative: v.isQuantitative,
  isOffBalance: v.isOffBalance,
  parentId: v.parentId,
  subcontoList: v.subcontoList,
})
