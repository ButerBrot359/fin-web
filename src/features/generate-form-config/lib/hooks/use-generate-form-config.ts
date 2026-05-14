import { useMutation } from '@tanstack/react-query'

import { generateFormConfig } from '../../api/generate-form-config'

interface UseGenerateFormConfigParams {
  moduleCode: string
  type?: string
  domain?: string
  onSuccess: () => void
}

export const useGenerateFormConfig = ({
  moduleCode,
  type,
  domain,
  onSuccess,
}: UseGenerateFormConfigParams) =>
  useMutation({
    mutationFn: () => generateFormConfig({ moduleCode, type, domain }),
    onSuccess,
  })
