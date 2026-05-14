import { formConfigsApi } from '@/shared/api/form-configs-api'

import type { FormConfig } from '@/entities/form-config'

interface GenerateFormConfigParams {
  moduleCode: string
  type?: string
  domain?: string
}

export const generateFormConfig = ({
  moduleCode,
  type,
  domain,
}: GenerateFormConfigParams) =>
  formConfigsApi.post<FormConfig>({
    url: `/api/configs/${moduleCode}`,
    params: { type, domain },
  })
