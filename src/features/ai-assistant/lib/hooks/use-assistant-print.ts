import { useMutation, type UseMutationResult } from '@tanstack/react-query'

import { apiService } from '@/shared/api/api'

export interface PrintTarget {
  typeCode: string
  entryId: number
}

/**
 * Печать документа по просьбе помощника.
 *
 * Сервер проверяет разрешение помощника заново при каждом нажатии, в том числе
 * для старых ответов после изменения настроек, затем использует обычный сервис печати.
 *
 * <p>Отдельный вызов, а не часть ответа модели: PDF в ленту диалога не положишь, и
 * возвращать его через промпт бессмысленно — помощник лишь называет документ, а
 * открывает печать браузер.
 */
export const useAssistantPrint = (): UseMutationResult<
  Blob,
  unknown,
  PrintTarget
> =>
  useMutation({
    mutationFn: ({ typeCode, entryId }: PrintTarget) =>
      apiService
        .getFileBlob({
          url: `/api/ai-assistant/documents/${encodeURIComponent(typeCode)}/${String(entryId)}/print`,
        })
        .then((response) => response.data),
    onSuccess: (blob) => {
      window.open(URL.createObjectURL(blob), '_blank')
    },
  })
