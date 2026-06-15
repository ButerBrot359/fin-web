import { useMutation } from '@tanstack/react-query'

import {
  generateFinancingPlan,
  parseFinancingPlan,
} from '../../api/financing-plan-upload-api'
import type {
  GenerateRequest,
  GenerateResult,
  ParseRequestParams,
  ParseResult,
} from '../../types/financing-plan-upload'

interface ParseArgs {
  file: File
  params: ParseRequestParams
}

/** Мутация разбора Excel — возвращает распарсенный результат (data из обёртки). */
export const useParseFinancingPlan = () =>
  useMutation<ParseResult, unknown, ParseArgs>({
    mutationFn: async ({ file, params }) => {
      const res = await parseFinancingPlan(file, params)
      return res.data.data
    },
  })

/** Мутация формирования и проведения документа. */
export const useGenerateFinancingPlan = () =>
  useMutation<GenerateResult, unknown, GenerateRequest>({
    mutationFn: async (body) => {
      const res = await generateFinancingPlan(body)
      return res.data.data
    },
  })
