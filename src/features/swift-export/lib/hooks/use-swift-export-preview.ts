import { useMutation } from '@tanstack/react-query'

import { previewSwiftExport } from '../../api/swift-export-api'
import type {
  SwiftExportPreview,
  SwiftExportRequest,
} from '../../types/swift-export'

export const useSwiftExportPreview = () =>
  useMutation<SwiftExportPreview, unknown, SwiftExportRequest>({
    mutationFn: async (request) => {
      const res = await previewSwiftExport(request)
      return res.data
    },
  })
