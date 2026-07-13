import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'

import {
  getDocumentEntry,
  getNewDocumentEntry,
} from '@/entities/document-entry'
import { useFormCacheStore } from '@/features/workspace-tabs'
import {
  markRestoring,
  unmarkRestoring,
} from '@/features/workspace-tabs/lib/hooks/use-form-cache-store'

function hasChanges(
  cached: Record<string, unknown>,
  defaults: Record<string, unknown>
): boolean {
  return Object.keys(cached).some(
    (key) => JSON.stringify(cached[key]) !== JSON.stringify(defaults[key])
  )
}

export const useDocumentEntryForm = () => {
  const { moduleCode = '', entryId } = useParams()
  const { pathname } = useLocation()
  const [searchParams] = useSearchParams()
  const restoredRef = useRef(false)

  const isNew = !entryId || entryId === 'new'
  const vidOperatsii = searchParams.get('VidOperatsii')
  const copyFrom = searchParams.get('copyFrom')
  const basisId = searchParams.get('basisId')
  const newEntryParams =
    vidOperatsii || basisId
      ? {
          ...(vidOperatsii && { VidOperatsii: vidOperatsii }),
          ...(basisId && { basisId }),
        }
      : undefined

  const { data: newEntryData, isLoading: isLoadingNewEntry } = useQuery({
    queryKey: ['document-entry-new', moduleCode, vidOperatsii, basisId],
    queryFn: () => getNewDocumentEntry(moduleCode, newEntryParams),
    enabled: isNew && (!!vidOperatsii || !!basisId) && !copyFrom,
    select: (response) => response.data.data,
  })

  const { data: copyFromData, isLoading: isLoadingCopy } = useQuery({
    queryKey: ['document-entry', copyFrom],
    queryFn: () => getDocumentEntry(copyFrom!),
    enabled: isNew && !!copyFrom,
    select: (response) => response.data.data,
  })

  const { data: existingEntry, isLoading: isLoadingEntry } = useQuery({
    queryKey: ['document-entry', entryId],
    queryFn: () => getDocumentEntry(entryId!),
    enabled: !isNew,
    select: (response) => response.data.data,
  })

  const form = useForm<Record<string, unknown>>({
    defaultValues: {},
  })

  useEffect(() => {
    let defaults: Record<string, unknown> | null = null

    if (!isNew && existingEntry?.attributes) {
      defaults = existingEntry.attributes
    } else if (isNew && copyFromData?.attributes) {
      const { Nomer: _, Kod: _k, ...rest } = copyFromData.attributes
      const copiedValues = { ...rest, Data: new Date().toISOString() }
      const emptyDefaults = { Data: new Date().toISOString() }

      form.reset(emptyDefaults)
      for (const [key, value] of Object.entries(copiedValues)) {
        form.setValue(key, value, { shouldDirty: true })
      }
      restoredRef.current = true
      return
    } else if (isNew && newEntryData?.attributes) {
      defaults = { Data: new Date().toISOString(), ...newEntryData.attributes }
    } else if (isNew && !vidOperatsii && !copyFrom && !basisId) {
      defaults = { Data: new Date().toISOString() }
    }

    if (!defaults) return

    const cached = useFormCacheStore.getState().getCachedValues(pathname)

    if (cached) {
      markRestoring(pathname)
      const isDirty = hasChanges(cached, defaults)
      if (isDirty) {
        form.reset(defaults)
        for (const [key, value] of Object.entries(cached)) {
          form.setValue(key, value, { shouldDirty: true })
        }
      } else {
        form.reset({ ...defaults, ...cached })
      }
      useFormCacheStore.getState().clearCache(pathname)
      useFormCacheStore.getState().setDirty(pathname, isDirty)
      restoredRef.current = isDirty
      queueMicrotask(() => {
        unmarkRestoring(pathname)
      })
    } else if (!form.formState.isDirty && !restoredRef.current) {
      form.reset(defaults)
    }
  }, [isNew, existingEntry, newEntryData, copyFromData, vidOperatsii, copyFrom, basisId, form, pathname])

  return {
    form,
    isNew,
    existingEntry,
    isLoading: isLoadingEntry || isLoadingNewEntry || isLoadingCopy,
  }
}
