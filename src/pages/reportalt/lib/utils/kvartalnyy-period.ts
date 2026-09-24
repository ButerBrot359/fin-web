import { isValid, parseISO } from 'date-fns'

import { quarterPeriod } from '@/shared/lib/utils/period-choice'

import type { PeriodValue } from './params'

export const kvartalDaty = (raw: string): PeriodValue | undefined => {
  const d = parseISO(raw)
  if (!isValid(d)) return undefined
  return quarterPeriod(d.getFullYear(), Math.floor(d.getMonth() / 3))
}
