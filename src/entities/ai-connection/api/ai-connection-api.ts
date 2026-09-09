import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type {
  AiConnection,
  AiConnectionTestResult,
  AiConnectionUpdate,
} from '../types/ai-connection'

const BASE_URL = '/api/ai-connections'

/**
 * Два уровня разворачивания: axios отдаёт `AxiosResponse`, внутри которого лежит
 * `ApiDataResponse` бэкенда. Пропуск одного возвращает наружу конверт.
 */
const unwrap = <T>(res: { data: ApiResponse<T> }): T => res.data.data

export const aiConnectionApi = {
  list: (signal?: AbortSignal): Promise<AiConnection[]> =>
    apiService
      .get<ApiResponse<AiConnection[]>>({ url: BASE_URL, signal })
      .then(unwrap),

  create: (request: AiConnectionUpdate): Promise<AiConnection> =>
    apiService
      .post<ApiResponse<AiConnection>>({ url: BASE_URL, data: request })
      .then(unwrap),

  update: (id: number, request: AiConnectionUpdate): Promise<AiConnection> =>
    apiService
      .put<ApiResponse<AiConnection>>({
        url: `${BASE_URL}/${String(id)}`,
        data: request,
      })
      .then(unwrap),

  remove: (id: number): Promise<void> =>
    apiService
      .delete<ApiResponse<void>>({ url: `${BASE_URL}/${String(id)}` })
      .then(unwrap),

  test: (id: number): Promise<AiConnectionTestResult> =>
    apiService
      .post<ApiResponse<AiConnectionTestResult>>({
        url: `${BASE_URL}/${String(id)}/test`,
      })
      .then(unwrap),
}
