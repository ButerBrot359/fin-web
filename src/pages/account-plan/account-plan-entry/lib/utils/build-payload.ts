import type { AccountPlanEntryPayload } from '@/entities/account-plan'

import type { AccountPlanCardValue } from '../../ui/account-plan-card'

/** Маппинг карточного value -> payload для бэка (опускаем пустую nameKz). */
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
  // Шлём ПОЛНЫЙ набор EAV-атрибутов (бэк на update пересоздаёт значения),
  // перезаписав редактируемый номер мемориального ордера.
  attributes: {
    ...v.attributes,
    NomerMemorialnogoOrdera: v.nomerMemorialnogoOrdera,
  },
})
