import { apiService } from '@/shared/api/api'
import { getUniversalTypeUrl } from '@/shared/lib/consts/data-types'
import type { ApiResponse } from '@/shared/types/api.types'
import type { DocumentType } from '@/entities/document-type'

export const getInformationRegisterType = (domain: string, code: string) =>
  apiService.get<ApiResponse<DocumentType>>({
    url: getUniversalTypeUrl(domain, code),
  })

/**
 * Удаление записи регистра сведений (1С «Удалить», Del в списке).
 * Эндпоинт общий для всех регистров — тип в пути не участвует, запись
 * адресуется по id.
 */
export const deleteInformationRegisterEntry = (id: number) =>
  apiService.delete<ApiResponse<void>>({
    url: `/api/information-register-entries/${String(id)}`,
  })
