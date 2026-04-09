import { useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'

import {
  getDocumentEntry,
  getNewDocumentEntry,
} from '@/entities/document-entry'

export const useDocumentEntryForm = () => {
  const { moduleCode = '', entryId } = useParams()
  const [searchParams] = useSearchParams()

  const isNew = !entryId || entryId === 'new'
  const vidOperatsii = searchParams.get('VidOperatsii')

  const newEntryParams = useMemo(() => {
    if (!vidOperatsii) return undefined
    return { VidOperatsii: vidOperatsii }
  }, [vidOperatsii])

  const { data: newEntryData, isLoading: isLoadingNewEntry } = useQuery({
    queryKey: ['document-entry-new', moduleCode, newEntryParams],
    queryFn: () => getNewDocumentEntry(moduleCode, newEntryParams),
    enabled: isNew && !!newEntryParams,
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
    if (!isNew && existingEntry?.attributes) {
      form.reset(existingEntry.attributes)
      return
    }
    if (isNew && newEntryData?.attributes) {
      form.reset({ Data: new Date().toISOString(), ...newEntryData.attributes })
      return
    }
    if (isNew && !newEntryParams) {
      form.reset({ Data: new Date().toISOString() })
    }
  }, [isNew, existingEntry, newEntryData, newEntryParams, form])

  return {
    form,
    isNew,
    existingEntry,
    isLoading: isLoadingEntry || isLoadingNewEntry,
  }
}
