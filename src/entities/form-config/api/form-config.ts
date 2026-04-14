import { formConfigsApi } from '@/shared/api/form-configs-api'

import type { FormConfig } from '../types/form-config'

export const getFormConfig = (name: string, type?: string, domain?: string) =>
  formConfigsApi.get<FormConfig>({
    url: `/api/configs/${name}`,
    params: { type, domain },
  })

export const getFormConfigList = (type?: string) =>
  formConfigsApi.get<string[]>({ url: '/api/configs', params: { type } })
