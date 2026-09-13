import { useCallback, useRef, useState } from 'react'

import { fetchReportAltParamState } from '../../api/reportalt-api'
import type { ReportAltParamStateDto } from '../../types/reportalt'

const EMPTY_PARAM_STATE: ReportAltParamStateDto = {
  values: {},
  disabledParams: [],
  optionsSources: {},
  messages: {},
}

export const useReportAltParamState = (code: string) => {
  const [paramState, setParamState] =
    useState<ReportAltParamStateDto>(EMPTY_PARAM_STATE)
  const requestSeqRef = useRef(0)

  const refreshParamState = useCallback(
    async (
      parameters: Record<string, unknown>,
      changedParam: string | null
    ): Promise<ReportAltParamStateDto | null> => {
      const seq = ++requestSeqRef.current
      try {
        const response = await fetchReportAltParamState(code, {
          parameters,
          changedParam,
        })
        if (seq !== requestSeqRef.current) return null
        const next = { ...EMPTY_PARAM_STATE, ...response }
        setParamState(next)
        return next
      } catch {
        return null
      }
    },
    [code]
  )

  return { paramState, refreshParamState }
}
