import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import type { UseFormReturn } from 'react-hook-form'

import { useWorkspaceTabsStore } from './use-workspace-tabs-store'

interface UseTabFormPersistenceOptions {
  isLoading: boolean
  tabId?: string
}

export function useTabFormPersistence(
  form: UseFormReturn<Record<string, unknown>>,
  { isLoading, tabId }: UseTabFormPersistenceOptions
) {
  const { pathname } = useLocation()

  // For router pages tab ID = pathname; for sidebar tabs explicit tabId is passed
  const resolvedId = tabId ?? pathname

  const restoredRef = useRef(false)
  const isDirtyRef = useRef(false)

  // Restore form snapshot after data loads
  useEffect(() => {
    if (isLoading || restoredRef.current) return

    if (!resolvedId) {
      restoredRef.current = true
      return
    }

    const tab = useWorkspaceTabsStore
      .getState()
      .tabs.find((t) => t.id === resolvedId)

    if (!tab?.formSnapshot) {
      restoredRef.current = true
      return
    }

    const { values, defaultValues } = tab.formSnapshot

    form.reset(defaultValues)

    for (const key of Object.keys(values)) {
      if (JSON.stringify(values[key]) !== JSON.stringify(defaultValues[key])) {
        form.setValue(key, values[key], { shouldDirty: true })
      }
    }

    useWorkspaceTabsStore.getState().clearFormSnapshot(resolvedId)
    restoredRef.current = true
  }, [isLoading, resolvedId, form])

  // Sync isDirty to tab store
  const isDirty = form.formState.isDirty

  useEffect(() => {
    isDirtyRef.current = isDirty
    if (resolvedId) {
      useWorkspaceTabsStore.getState().setTabDirty(resolvedId, isDirty)
    }
  }, [isDirty, resolvedId])

  // Save form snapshot on unmount if dirty
  useEffect(() => {
    const id = resolvedId

    return () => {
      if (!id || !isDirtyRef.current) return

      const currentValues = form.getValues()
      const defaultValues =
        (form.formState.defaultValues as Record<string, unknown> | undefined) ??
        {}

      if (Object.keys(currentValues).length === 0) return

      useWorkspaceTabsStore
        .getState()
        .saveFormSnapshot(id, { values: currentValues, defaultValues })
    }
  }, [resolvedId, form])
}
