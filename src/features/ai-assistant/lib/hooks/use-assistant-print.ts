import { useMutation, type UseMutationResult } from '@tanstack/react-query'

import { printDocumentEntry } from '@/entities/document-entry'

export interface PrintTarget {
  typeCode: string
  entryId: number
}

/**
 * Печать документа по просьбе помощника.
 *
 * <p>Зовёт ту же функцию, что кнопка «Печать» на форме документа, и так же открывает
 * полученный PDF новой вкладкой. Своего пути к печати здесь нет намеренно: печатные
 * формы выбираются и собираются на сервере, и второй способ их получить разошёлся бы
 * с первым на первой же правке макета.
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
      printDocumentEntry(typeCode, entryId).then((response) => response.data),
    onSuccess: (blob) => {
      window.open(URL.createObjectURL(blob), '_blank')
    },
  })
