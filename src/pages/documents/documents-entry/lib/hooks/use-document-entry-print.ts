import { useQuery, useMutation } from '@tanstack/react-query'

import { getPrintCommands, printDocumentEntry } from '@/entities/document-entry'

import type { UseDocumentEntryPrintParams } from '../../types/document-entry-print'

export const useDocumentEntryPrint = ({
  moduleCode,
  entryId,
}: UseDocumentEntryPrintParams) => {
  const { data: printCommands = [], isLoading: isCommandsLoading } = useQuery({
    queryKey: ['print-commands', moduleCode],
    queryFn: async () => {
      const response = await getPrintCommands(moduleCode)
      return response.data
    },
    enabled: !!moduleCode,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: async (form?: string) => {
      if (!entryId) throw new Error('Cannot print without entry ID')
      const response = await printDocumentEntry(moduleCode, entryId, form)
      return response.data
    },
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    },
  })

  const handlePrint = (form?: string) => {
    if (!entryId) return
    mutate(form)
  }

  return {
    printCommands,
    isCommandsLoading,
    handlePrint,
    isPrintLoading: isPending,
  }
}
