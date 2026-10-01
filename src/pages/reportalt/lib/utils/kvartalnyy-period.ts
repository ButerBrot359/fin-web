import { quarterOf } from '@/shared/lib/utils/period-choice'

import type { PeriodValue } from './params'

export const kvartalDaty = (raw: string): PeriodValue | undefined =>
  quarterOf(raw)
