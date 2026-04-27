import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { getInformationRegisterEntries } from '../../api/information-register-api'
import type { InformationRegisterEntry } from '../../types/information-register'

const EMPTY_LIST: InformationRegisterEntry[] = []

export const useInformationRegisterEntries = (typeCode: string) => {
  const { data, isLoading } = useQuery({
    queryKey: ['information-register-entries', typeCode],
    queryFn: () => getInformationRegisterEntries(typeCode),
    staleTime: 60 * 1000,
  })

  const entries = useMemo(() => {
    const body = data?.data as Record<string, unknown> | undefined
    if (!body) return EMPTY_LIST

    if (Array.isArray(body.list)) return body.list as InformationRegisterEntry[]

    const inner = body.data as Record<string, unknown> | undefined
    if (inner && Array.isArray(inner.content))
      return inner.content as InformationRegisterEntry[]

    return EMPTY_LIST
  }, [data])

  return { entries, isLoading }
}
