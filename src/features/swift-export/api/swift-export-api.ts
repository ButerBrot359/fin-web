import { apiService } from '@/shared/api/api'

import type {
  SwiftEncoding,
  SwiftExportPreview,
  SwiftExportRequest,
  SwiftFormat,
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

export const fetchSwiftExportBlob = (
  typeCode: string,
  id: number,
  format: SwiftFormat,
  encoding: SwiftEncoding,
  signal?: AbortSignal
) =>
  apiService.getFileBlob({
    url: `/api/document-entries/${typeCode}/${String(id)}/swift-export`,
    params: { format, encoding },
    signal,
  })
