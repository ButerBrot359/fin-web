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

  const { data: newEntryData } = useQuery({
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

  const todayISO = useMemo(() => new Date().toISOString(), [])

  useEffect(() => {
    if (isNew && newEntryData?.attributes) {
      form.reset({
        Data: todayISO,
        ...newEntryData.attributes,
      })
    }
  }, [newEntryData, form, isNew, todayISO])

  useEffect(() => {
    if (isNew && !newEntryParams && !form.getValues('Data')) {
      form.setValue('Data', todayISO)
    }
  }, [isNew, newEntryParams, form, todayISO])

  useEffect(() => {
    if (!isNew && existingEntry?.attributes) {
      form.reset(existingEntry.attributes)
    }
  }, [existingEntry, form, isNew])

  return { form, isNew, existingEntry, isLoadingEntry }
}
