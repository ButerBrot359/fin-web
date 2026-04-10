import { useMutation } from '@tanstack/react-query'

import { printDocumentEntry } from '@/entities/document-entry'

import type { UseDocumentEntryPrintParams } from '../../types/document-entry-print'

export const useDocumentEntryPrint = ({
  moduleCode,
  entryId,
}: UseDocumentEntryPrintParams) => {
  const { mutate, isPending } = useMutation({
    mutationFn: async (language?: string) => {
      if (!entryId) throw new Error('Cannot print without entry ID')
      const response = await printDocumentEntry(moduleCode, entryId, language)
      return response.data
    },
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    },
  })

  const handlePrint = (language?: string) => {
    if (!entryId) return
    mutate(language)
  }

  return { handlePrint, isPrintLoading: isPending }
}
