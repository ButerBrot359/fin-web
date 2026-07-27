import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'

import type {
  TreasuryExportItem,
  TreasuryExportPreviewResponse,
} from '../types/treasury-export'

/**
 * Построчная проверка пакета документов (строит таблицу «Выгружаемые документы»).
 * POST /api/treasury-export/preview — 200 даже при ошибках строк.
 */
export const previewTreasuryExport = (
  items: TreasuryExportItem[],
  signal?: AbortSignal
) =>
  apiService.post<ApiResponse<TreasuryExportPreviewResponse>>({
    url: '/api/treasury-export/preview',
    data: { items },
    signal,
  })

/**
 * Байты XML одиночного документа (для записи в выбранную папку, Chromium).
 * GET одиночного эндпоинта как blob; имя файла берём из preview (row.fileName).
 */
export const fetchTreasuryExportBlob = (
  typeCode: string,
  id: number,
  signal?: AbortSignal
) =>
  apiService.getFileBlob({
    url: `/api/document-entries/${typeCode}/${String(id)}/treasury-export`,
    signal,
  })
