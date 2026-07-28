import { useShallow } from 'zustand/shallow'

import {
  resolveOptionsParams,
  type OptionsParamValue,
} from '../utils/resolve-options-params'
import { useSduiSession } from '../sdui-session-context'
import { useViewStateStore } from '../stores/view-state-store'

/**
 * Реактивно резолвит `optionsSource.params` (в т.ч. декларативные `{ fromBinding }`)
 * в плоские query-параметры. Значения полей-источников читаются из стейта формы.
 *
 * Root: zustand-селектор со `useShallow` — нода ре-рендерится только когда изменился
 * РЕЗУЛЬТАТ резолва, а не любое поле формы (сохраняем оптимизацию M1).
 * Panel: снапшот через `session.getValue` (как в `useBindingValue`).
 */
export function useResolvedOptionsParams(
  params: Record<string, OptionsParamValue> | undefined,
): Record<string, string> {
  const session = useSduiSession()

  const rootResolved = useViewStateStore(
    useShallow((s) => resolveOptionsParams(params, (b) => s.state[b])),
  )

  if (session.kind === 'root') return rootResolved
  return resolveOptionsParams(params, session.getValue)
}
