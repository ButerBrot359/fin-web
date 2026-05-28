import { z } from 'zod'

import type { AccountPlanSubkontoKindDto } from '@/entities/account-plan'

/** Схема карточного value — code обязателен, accountType — литералы DTO. */
export const accountPlanCardSchema = z.object({
  code: z.string().min(1, 'accountPlan.validation.codeRequired'),
  nameRu: z.string(),
  nameKz: z.string().nullable(),
  accountType: z.enum(['A', 'P', 'AP']),
  isCurrency: z.boolean(),
  isQuantity: z.boolean(),
  isOffBalance: z.boolean(),
  isGroup: z.boolean(),
  parentId: z.number().nullable(),
  parentName: z.string().nullable(),
})

/** На счёт допускается до 3 видов субконто, позиции — 1, 2, 3 без пропусков. */
export const validateSubkontoKinds = (
  kinds: AccountPlanSubkontoKindDto[]
): string | null => {
  if (kinds.length > 3) return 'accountPlan.validation.maxSubkonto'
  const positions = kinds.map((k) => k.position).sort((a, b) => a - b)
  for (let i = 0; i < positions.length; i += 1) {
    if (positions[i] !== i + 1) return 'accountPlan.validation.subkontoPositionsInvalid'
  }
  return null
}
