import { formConfigsApi } from '@/shared/api/form-configs-api'

import type { FormConfig } from '../types/form-config'

export const getFormConfig = (name: string) =>
  formConfigsApi.get<FormConfig>({ url: `/api/configs/${name}` })

export const getFormConfigList = () =>
  formConfigsApi.get<string[]>({ url: '/api/configs' })
