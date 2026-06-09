import type { AccountPlanEntryPayload } from '@/entities/account-plan'

import type { AccountPlanCardValue } from '../../ui/account-plan-card'

/**
 * Маппинг карточного value -> payload для бэка (опускаем пустую nameKz).
 * «Номер МО» уходит в attributes как EAV-атрибут NomerMemorialnogoOrdera.
 */
export const buildAccountPlanPayload = (
  v: AccountPlanCardValue
): AccountPlanEntryPayload => ({
  code: v.code,
  nameRu: v.nameRu,
  nameKz: v.nameKz ? v.nameKz : null,
  accountType: v.accountType,
  isCurrency: v.isCurrency,
  isQuantity: v.isQuantity,
  isOffBalance: v.isOffBalance,
  isGroup: v.isGroup,
  parentId: v.parentId,
  attributes: { NomerMemorialnogoOrdera: v.nomerMo },
})
