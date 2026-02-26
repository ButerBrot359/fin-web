import { apiService } from './api'

const BASE_URL = '/api/settings'

export const getModule = (moduleId: string) =>
  apiService.get({ url: `${BASE_URL}/modules/${moduleId}` })

export const settingsApi = {
  getModule,
}
