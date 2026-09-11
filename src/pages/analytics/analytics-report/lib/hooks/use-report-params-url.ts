import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { AnalyticsParameter } from '@/entities/analytics'
import { resolveDefaultParams } from '@/features/analytics-params'
import type { AnalyticsParamValues } from '@/features/analytics-params'

/** Ключ query-string с применёнными параметрами отчёта (весь набор — JSON). */
const PARAMS_URL_KEY = 'ap'

const parseUrlValues = (raw: string | null): AnalyticsParamValues | null => {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null
    }
    return parsed as AnalyticsParamValues
  } catch {
    return null
  }
}

export interface ReportParamsUrlState {
  /** Черновик формы — что пользователь правит до «Сформировать». */
  values: AnalyticsParamValues
  setValues: (values: AnalyticsParamValues) => void
  /** Применённые параметры из URL; `null` — отчёт ещё не формировали. */
  applied: AnalyticsParamValues | null
  /** Кладёт черновик в URL. `true` — параметры те же, нужен ручной refetch. */
  apply: () => boolean
}

/**
 * Параметры отчёта живут в query-string: так сформированный отчёт переживает
 * переключение вкладок и F5 (тот же приём, что на странице отчётов легаси).
 */
export const useReportParamsUrl = (
  parameters: AnalyticsParameter[],
  autoBuild = false
): ReportParamsUrlState => {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(PARAMS_URL_KEY)

  const applied = useMemo(
    () =>
      parseUrlValues(raw) ??
      (autoBuild ? resolveDefaultParams(parameters) : null),
    [raw, autoBuild, parameters]
  )

  const [values, setValues] = useState<AnalyticsParamValues>(
    () => parseUrlValues(raw) ?? resolveDefaultParams(parameters)
  )

  // Смена спецификации (у ассистента — почти каждый ответ) пересобирает форму.
  // В рендере по смене пропа, а не в эффекте: лишний проход здесь означал бы
  // отрисовку формы с параметрами прошлого отчёта.
  const [prevParameters, setPrevParameters] = useState(parameters)
  if (parameters !== prevParameters) {
    setPrevParameters(parameters)
    setValues(parseUrlValues(raw) ?? resolveDefaultParams(parameters))
  }

  const apply = useCallback((): boolean => {
    const next = JSON.stringify(values)
    const isSame = next === raw
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.set(PARAMS_URL_KEY, next)
        return params
      },
      { replace: true }
    )
    return isSame
  }, [values, raw, setSearchParams])

  return { values, setValues, applied, apply }
}
