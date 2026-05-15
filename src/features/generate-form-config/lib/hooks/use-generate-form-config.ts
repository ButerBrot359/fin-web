import { useTrackedMutation } from '@/shared/lib/loader/use-tracked-mutation'

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
  useTrackedMutation({
    mutationFn: () => generateFormConfig({ moduleCode, type, domain }),
    onSuccess,
  })
