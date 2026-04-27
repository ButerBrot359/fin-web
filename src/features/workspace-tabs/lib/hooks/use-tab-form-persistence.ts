import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { UseFormReturn } from 'react-hook-form'

import { useWorkspaceTabsStore } from './use-workspace-tabs-store'
import { formSnapshotCache } from './form-snapshot-cache'

interface UseTabFormPersistenceOptions {
  isLoading: boolean
  tabId?: string
}

export function useTabFormPersistence(
  form: UseFormReturn<Record<string, unknown>>,
  { isLoading, tabId }: UseTabFormPersistenceOptions
) {
  const { pathname } = useLocation()
  const [resolvedId] = useState(() => tabId ?? pathname)
  const restoredRef = useRef(false)

  // Save form snapshot on EVERY change via watch — no cleanup dependency
  useEffect(() => {
    if (!resolvedId) return

    const subscription = form.watch(() => {
      const values = form.getValues()
      const defaultValues =
        (form.formState.defaultValues as Record<string, unknown> | undefined) ??
        {}

      formSnapshotCache.set(resolvedId, { values, defaultValues })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [resolvedId, form])

  // Restore form snapshot after data loads
  useEffect(() => {
    if (isLoading || restoredRef.current || !resolvedId) return

    const snapshot = formSnapshotCache.get(resolvedId)

    if (!snapshot) {
      restoredRef.current = true
      return
    }

    const { values, defaultValues } = snapshot

    form.reset(defaultValues)

    for (const key of Object.keys(values)) {
      if (JSON.stringify(values[key]) !== JSON.stringify(defaultValues[key])) {
        form.setValue(key, values[key], { shouldDirty: true })
      }
    }

    formSnapshotCache.delete(resolvedId)
    restoredRef.current = true
  }, [isLoading, resolvedId, form])

  // Sync isDirty to tab store
  const isDirty = form.formState.isDirty

  useEffect(() => {
    if (resolvedId) {
      useWorkspaceTabsStore.getState().setTabDirty(resolvedId, isDirty)
    }
  }, [isDirty, resolvedId])
}
