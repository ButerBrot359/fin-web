import { apiService } from '@/shared/api/api'

import type {
  SwiftExportPreview,
  SwiftExportRequest,
} from '../types/swift-export'

export const previewSwiftExport = (
  request: SwiftExportRequest,
  signal?: AbortSignal
) =>
  apiService.post<SwiftExportPreview>({
    url: '/api/document-entries/swift-export/preview',
    data: request,
    signal,
  })
