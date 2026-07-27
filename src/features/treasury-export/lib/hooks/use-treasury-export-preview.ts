import { useMutation } from '@tanstack/react-query'

import { previewTreasuryExport } from '../../api/treasury-export-api'
import type {
  TreasuryExportItem,
  TreasuryExportPreviewResponse,
} from '../../types/treasury-export'

/** Мутация проверки документов — возвращает data из обёртки ApiResponse. */
export const useTreasuryExportPreview = () =>
  useMutation<TreasuryExportPreviewResponse, unknown, TreasuryExportItem[]>({
    mutationFn: async (items) => {
      const res = await previewTreasuryExport(items)
      return res.data.data
    },
  })
