import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/lib/hooks/use-auth-store'
import { analyticsApi } from '../../api/analytics-api'
import type { AnalyticsDictionaryPermissionPage } from '../../types/dictionary-permissions'

export const dictionaryPermissionKeys = {
  owner: (owner: number | null) =>
    [
      'analytics',
      'dictionary-permissions',
      window.location.origin,
      owner,
    ] as const,
  page: (owner: number | null, q: string, page: number) =>
    [...dictionaryPermissionKeys.owner(owner), q, page, 50] as const,
}
export function useDictionaryPermissions(q: string, page: number) {
  const owner = useAuthStore((state) => state.user?.id ?? null)
  const query = useQuery({
    queryKey: dictionaryPermissionKeys.page(owner, q, page),
    queryFn: ({ signal }) =>
      analyticsApi.getDictionaryPermissions(q, page, signal),
    enabled: owner != null,
    retry: false,
  })
  return { ...query, ownerId: owner }
}
/** Each row owns its pending state. Values change only after server acknowledgement. */
export function useUpdateDictionaryPermission() {
  const owner = useAuthStore((state) => state.user?.id ?? null)
  const client = useQueryClient()
  const locked = useRef(false)
  const mutation = useMutation({
    mutationFn: ({
      typeCode,
      allowed,
    }: {
      typeCode: string
      allowed: boolean
      owner: number | null
    }) => analyticsApi.updateDictionaryPermission(typeCode, allowed),
    onSuccess: (saved, variables) => {
      client.setQueriesData<AnalyticsDictionaryPermissionPage>(
        { queryKey: dictionaryPermissionKeys.owner(variables.owner) },
        (old) => {
          if (!old) return old
          const previous = old.items.find(
            (row) => row.typeCode === saved.typeCode
          )
          return {
            ...old,
            items: old.items.map((row) =>
              row.typeCode === saved.typeCode ? saved : row
            ),
            allowedCount: previous
              ? old.allowedCount +
                Number(saved.allowed) -
                Number(previous.allowed)
              : old.allowedCount,
          }
        }
      )
      void client.invalidateQueries({
        queryKey: dictionaryPermissionKeys.owner(variables.owner),
      })
      void client.invalidateQueries({
        queryKey: ['ai-assistant', 'disclosure'],
      })
    },
    onSettled: () => {
      locked.current = false
    },
  })
  const update = (typeCode: string, allowed: boolean) => {
    if (locked.current || owner == null) return
    locked.current = true
    mutation.mutate({ typeCode, allowed, owner })
  }
  return { ...mutation, update }
}
