import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchDictEntriesPaged } from '@/features/dict-sidebar/api/dict-sidebar-api'
import type { DictEntry } from '@/features/dict-sidebar/api/dict-sidebar-api'

const EMPTY_LIST: DictEntry[] = []

export const useDictionaryEntries = (domain: string, typeCode: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['dict-entries', domain, typeCode],
    queryFn: ({ signal }) =>
      fetchDictEntriesPaged(domain, typeCode, { page: 0, size: 100 }, signal),
    staleTime: 60 * 1000,
  })

  const entries = useMemo(() => {
    const body = data?.data as Record<string, unknown> | undefined
    if (!body) return EMPTY_LIST

    // API может вернуть { list: [...] } или { data: { content: [...] } }
    if (Array.isArray(body.list)) return body.list as DictEntry[]
    const inner = body.data as Record<string, unknown> | undefined
    if (inner && Array.isArray(inner.content))
      return inner.content as DictEntry[]

    return EMPTY_LIST
  }, [data])

  return { entries, isLoading }
}
