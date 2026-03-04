import { apiService } from '@/shared/api/api'
import type { ModuleResponseData } from '../types/module'

const BASE_URL = '/api/settings'

export const getModule = (moduleId: string) =>
  apiService.get<ModuleResponseData>({
    url: `${BASE_URL}/modules/${moduleId}`,
  })
