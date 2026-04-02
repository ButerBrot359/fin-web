import { useQuery } from '@tanstack/react-query'

import {
  getDocumentType,
  type DocumentAttribute,
} from '@/entities/document-type'

export const useTableColumns = (attribute: DocumentAttribute) => {
  const rowTypeCode =
    (attribute.allowedTypes as { typeCode: string }[] | undefined)?.[0]
      ?.typeCode ?? ''

  const { data: columns = [], isLoading } = useQuery({
    queryKey: ['document-type-columns', rowTypeCode],
    queryFn: async () => {
      const response = await getDocumentType(rowTypeCode)
      const attrs = response.data.data.attributes
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
