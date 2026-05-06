import { useEffect, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'

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

  // Sync isDirty to cache store via form.watch subscription.
  // Skips during restore (isRestoring) to avoid overwriting the manually set dirty flag.
  useEffect(() => {
    const { setDirty } = useFormCacheStore.getState()

    if (!isRestoring(tabId)) {
      setDirty(tabId, form.formState.isDirty)
    }

    const subscription = form.watch(() => {
      if (isRestoring(tabId)) return
      setDirty(tabId, form.formState.isDirty)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [tabId, form])

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
