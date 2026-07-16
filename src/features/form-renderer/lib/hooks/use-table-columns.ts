import { useQuery } from '@tanstack/react-query'

import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'
import { getUniversalTypeUrl } from '@/shared/lib/consts/data-types'
import {
  getDocumentType,
  type DocumentAttribute,
} from '@/entities/document-type'

interface RowTypeMetadata {
  attributes: DocumentAttribute[]
}

/**
 * Метаданные табличной части (row-типа) лежат в таблице типов СВОЕГО домена:
 * ТЧ документа — в document_types, ТЧ справочника — в dictionary_types и т.д.
 * Раньше грузили безусловно с `/api/document-types/{code}`, из-за чего ТЧ
 * справочников (напр. `Valyuty_Predstavleniya`) отдавали 400 «Document type not
 * found» и форма справочника не достраивалась/не сохранялась. Теперь эндпоинт
 * выбираем по домену родительской формы через универсальный types-резолвер
 * (`/api/universaldomain-types/{domain}/{code}`); DOCUMENT — прежний путь.
 */
const fetchRowTypeAttributes = async (
  domain: string | undefined,
  rowTypeCode: string
): Promise<DocumentAttribute[]> => {
  if (domain && domain !== 'DOCUMENT') {
    const res = await apiService.get<ApiResponse<RowTypeMetadata>>({
      url: getUniversalTypeUrl(domain, rowTypeCode),
    })
    return res.data.data.attributes
  }
  const res = await getDocumentType(rowTypeCode)
  return res.data.data.attributes
}

export const useTableColumns = (
  attribute: DocumentAttribute,
  domain?: string
) => {
  const rowTypeCode =
    (attribute.allowedTypes as { typeCode: string }[] | undefined)?.[0]
      ?.typeCode ?? ''

  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['type-columns', domain ?? 'DOCUMENT', rowTypeCode],
    queryFn: async () => {
      const attrs = await fetchRowTypeAttributes(domain, rowTypeCode)
      return attrs
        .filter((a: DocumentAttribute) => a.showInForm)
        .sort(
          (a: DocumentAttribute, b: DocumentAttribute) =>
            a.sortOrder - b.sortOrder
        )
    },
    enabled: !!rowTypeCode,
    staleTime: 5 * 60 * 1000,
  })

  return { columns, isLoading }
}
