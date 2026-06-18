import type { UseFormReturn } from 'react-hook-form'

import { aggregateWorkers } from '../utils/aggregate-workers'

export const useConsolidatedData = (
  form: UseFormReturn<Record<string, unknown>>
) => {
  const values = form.watch()

  const dannyeRabotnikov = (values.DannyeRabotnikov ?? []) as Record<string, unknown>[]
  const nachisleniya = (values.NachisleniyaRabotnikov ?? []) as Record<string, unknown>[]
  const dopNachisleniya = (values.DopolnitelnyeNachisleniya ?? []) as Record<string, unknown>[]

  return aggregateWorkers(dannyeRabotnikov, nachisleniya, dopNachisleniya)
}
