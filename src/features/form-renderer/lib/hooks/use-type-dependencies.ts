import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'

import type { DocumentAttribute } from '@/entities/document-type'
import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'
import {
  REFERENCE_DOMAIN_KINDS,
  getUniversalTypeUrl,
  resolveAttributeDomain,
} from '@/shared/lib/consts/data-types'
import type { FieldDependency } from '../../types/renderer-context'

interface DependsOnEntry {
  sourceAttributeCode: string
  targetAttributeCode: string
}

interface TypeMetadata {
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
        const resolved = resolveAttributeDomain(attr)
        return resolved && REFERENCE_DOMAIN_KINDS.has(resolved.domain)
      }),
    [attributes]
  )

  const uniqueTypes = useMemo(() => {
    const seen = new Map<string, DocumentAttribute>()
    for (const attr of dictAttributes) {
      const resolved = resolveAttributeDomain(attr)
      if (!resolved) continue
      const key = `${resolved.domain}:${resolved.typeCode}`
      if (!seen.has(key)) {
        seen.set(key, attr)
      }
    }
    return Array.from(seen.values())
  }, [dictAttributes])

  // `combine` — по той же причине, что и в useFieldOptions: без него useQueries
  // отдаёт новый массив на каждый рендер, dependencyMap пересоздаётся, и весь
  // contextValue формы меняет идентичность впустую.
  const dependsOnLists = useQueries({
    queries: uniqueTypes.map((attr) => {
      const resolved = resolveAttributeDomain(attr)!
      const url = getUniversalTypeUrl(resolved.domain, resolved.typeCode)

      return {
        queryKey: ['type-metadata', resolved.domain, resolved.typeCode],
        queryFn: () => apiService.get<ApiResponse<TypeMetadata>>({ url }),
        staleTime: 10 * 60 * 1000,
      }
    }),
    combine: (results) =>
      results.map((result) => result.data?.data.data.dependsOn),
  })

  const dependencyMap = useMemo(() => {
    const map = new Map<string, FieldDependency>()

    uniqueTypes.forEach((attr, index) => {
      const dependsOn = dependsOnLists[index]
      if (!dependsOn?.length) return

      const resolved = resolveAttributeDomain(attr)
      if (!resolved) return

      for (const dep of dependsOn) {
        const dependentFields = dictAttributes.filter((a) => {
          const aResolved = resolveAttributeDomain(a)
          return (
            aResolved?.domain === resolved.domain &&
            aResolved.typeCode === resolved.typeCode
          )
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
  }, [uniqueTypes, dictAttributes, dependsOnLists])

  return { dependencyMap }
}
