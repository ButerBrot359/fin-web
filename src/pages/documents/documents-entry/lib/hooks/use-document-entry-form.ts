import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'

import {
  getDocumentEntry,
  getNewDocumentEntry,
} from '@/entities/document-entry'

export const useDocumentEntryForm = () => {
  const { moduleCode = '', entryId } = useParams()
  const [searchParams] = useSearchParams()

  const isNew = !entryId || entryId === 'new'
  const vidOperatsii = searchParams.get('VidOperatsii')
  const newEntryParams = vidOperatsii
    ? { VidOperatsii: vidOperatsii }
    : undefined

  const { data: newEntryData, isLoading: isLoadingNewEntry } = useQuery({
    queryKey: ['document-entry-new', moduleCode, vidOperatsii],
    queryFn: () => getNewDocumentEntry(moduleCode, newEntryParams),
    enabled: isNew && !!vidOperatsii,
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
    if (isNew && !vidOperatsii) {
      form.reset({ Data: new Date().toISOString() })
    }
  }, [isNew, existingEntry, newEntryData, vidOperatsii, form])

  return {
    form,
    isNew,
    existingEntry,
    isLoading: isLoadingEntry || isLoadingNewEntry,
  }
}
