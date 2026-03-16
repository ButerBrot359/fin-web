import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import type { DocumentAttribute } from '@/entities/document-type'
import { apiService } from '@/shared/api/api'
import { DICT_DATA_TYPES, getTypeUrl } from '@/shared/lib/consts/data-types'
import type { FieldDependency } from '../../types/renderer-context'

interface DependsOnEntry {
  sourceAttributeCode: string
  targetAttributeCode: string
}

interface TypeMetadataResponse {
  dependsOn?: DependsOnEntry[]
}

interface UseTypeDependenciesParams {
  attributes: DocumentAttribute[]
}

export const useTypeDependencies = ({
  attributes,
}: UseTypeDependenciesParams) => {
  const dictAttributes = useMemo(
    () =>
      attributes.filter((attr) => {
        if (!DICT_DATA_TYPES.has(attr.dataType)) return false
        const typeCode =
          attr.referenceTypeCode ??
          (attr.allowedTypes as { typeCode: string }[] | undefined)?.[0]
            ?.typeCode
        return !!typeCode
      }),
    [attributes]
  )

  const uniqueTypes = useMemo(() => {
    const seen = new Map<string, DocumentAttribute>()
    for (const attr of dictAttributes) {
      const typeCode =
        attr.referenceTypeCode ??
        (attr.allowedTypes as { typeCode: string }[] | undefined)?.[0]?.typeCode
      const key = `${attr.dataType}:${typeCode ?? ''}`
      if (!seen.has(key)) {
        seen.set(key, attr)
      }
    }
    return Array.from(seen.values())
  }, [dictAttributes])

  const typeQueries = useQueries({
    queries: uniqueTypes.map((attr) => {
      const typeCode =
        attr.referenceTypeCode ??
        (attr.allowedTypes as { typeCode: string }[] | undefined)?.[0]
          ?.typeCode ??
        ''
      const url = getTypeUrl(attr.dataType, typeCode)!

      return {
        queryKey: ['type-metadata', attr.dataType, typeCode],
        queryFn: () => apiService.get<TypeMetadataResponse>({ url }),
        staleTime: 10 * 60 * 1000,
      }
    }),
  })

  const dependencyMap = useMemo(() => {
    const map = new Map<string, FieldDependency>()

    uniqueTypes.forEach((attr, index) => {
      const query = typeQueries[index]
      const dependsOn = query.data?.data.dependsOn
      if (!dependsOn?.length) return

      const typeCode =
        attr.referenceTypeCode ??
        (attr.allowedTypes as { typeCode: string }[] | undefined)?.[0]
          ?.typeCode ??
        ''

      for (const dep of dependsOn) {
        const dependentFields = dictAttributes.filter((a) => {
          const tc =
            a.referenceTypeCode ??
            (a.allowedTypes as { typeCode: string }[] | undefined)?.[0]
              ?.typeCode
          return a.dataType === attr.dataType && tc === typeCode
        })

        for (const field of dependentFields) {
          map.set(field.code, {
            sourceFieldCode: dep.sourceAttributeCode,
            targetAttributeCode: dep.targetAttributeCode,
          })
        }
      }
    })

    return map
  }, [uniqueTypes, dictAttributes, typeQueries])

  return { dependencyMap }
}
