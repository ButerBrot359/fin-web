import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWatch, type Control } from 'react-hook-form'

import type { DocumentAttribute } from '@/entities/document-type'
import { apiService } from '@/shared/api/api'
import type { ApiResponse } from '@/shared/types/api.types'
import {
  getUniversalTypeUrl,
  resolveAttributeDomain,
} from '@/shared/lib/consts/data-types'

interface DependsOnEntry {
  sourceAttributeCode: string
  targetAttributeCode: string
}

interface TypeMetadata {
  dependsOn?: DependsOnEntry[]
}

export interface CellDependencyResult {
  searchParams: Record<string, string> | undefined
  disabled: boolean
}

// Resolves the dependent-dictionary filter for a table-part cell.
// A table row carries no owner context (e.g. organization), so the
// dependency source lives in the document header — we read it from the
// top-level form value by its attribute code. Mirrors the header logic in
// FieldNode, reusing the same `dependsOn` type metadata and `af` filter
// param so behavior stays consistent across header and table parts.
export const useCellDependency = (
  column: DocumentAttribute,
  control: Control<Record<string, unknown>>
): CellDependencyResult => {
  const resolved = resolveAttributeDomain(column)

  const { data: dependsOn } = useQuery({
    // Shared cache key with useTypeDependencies — same type metadata request.
    queryKey: ['type-metadata', resolved?.domain, resolved?.typeCode],
    queryFn: () =>
      apiService.get<ApiResponse<TypeMetadata>>({
        url: getUniversalTypeUrl(resolved!.domain, resolved!.typeCode),
      }),
    enabled: !!resolved,
    staleTime: 10 * 60 * 1000,
    select: (response) => response.data.data.dependsOn?.[0] ?? null,
  })

  // Source value comes from the header (top-level form field).
  const sourceValue = useWatch({
    control,
    name: dependsOn?.sourceAttributeCode ?? '',
  }) as { id?: number | string } | null | undefined

  return useMemo(() => {
    if (!dependsOn) return { searchParams: undefined, disabled: false }

    const sourceId = sourceValue?.id
    return {
      searchParams:
        sourceId != null
          ? { af: `${dependsOn.targetAttributeCode}:${String(sourceId)}` }
          : undefined,
      // No source selected → backend would return empty/400, so block input.
      disabled: sourceId == null,
    }
  }, [dependsOn, sourceValue?.id])
}
