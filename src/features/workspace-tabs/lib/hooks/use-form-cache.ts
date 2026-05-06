import { useEffect, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useFormState } from 'react-hook-form'

import { useWorkspaceTabsStore } from './use-workspace-tabs-store'
import { useFormCacheStore } from './use-form-cache-store'
import { isRestoring } from './use-form-cache-store'

interface UseFormCacheOptions {
  tabId: string
  form: UseFormReturn<Record<string, unknown>>
}

export function useFormCache({ tabId, form }: UseFormCacheOptions) {
  const isClosingRef = useRef(false)
  const formRef = useRef(form)

  useEffect(() => {
    formRef.current = form
  }, [form])

  const pendingAction = useFormCacheStore(
    (s) => s.pendingActions[tabId] ?? null
  )

  // Reactive isDirty from RHF — triggers re-render when dirty state changes.
  // Unlike form.watch() callback, this always has the correct isDirty value.
  const { isDirty } = useFormState({ control: form.control })

  useEffect(() => {
    if (isRestoring(tabId)) return
    useFormCacheStore.getState().setDirty(tabId, isDirty)
  }, [isDirty, tabId])

  // Always cache form values on unmount so StrictMode re-mount can restore.
  useEffect(() => {
    return () => {
      if (isClosingRef.current) return

      const tabStillExists = useWorkspaceTabsStore
        .getState()
        .tabs.some((t) => t.id === tabId)
      if (!tabStillExists) return

      const currentForm = formRef.current
      useFormCacheStore
        .getState()
        .setCachedValues(tabId, currentForm.getValues())
    }
  }, [tabId])

  const markClosing = () => {
    isClosingRef.current = true
  }

  return { pendingAction, markClosing }
}
