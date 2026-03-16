import { useCallback, useMemo } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'

import { apiService } from '@/shared/api/api'
import type { DocumentAttribute } from '@/entities/document-type'

interface HandleEventPayload {
  eventName: string
  entry: Record<string, unknown>
}

interface HandleEventResponse {
  attributes: Record<string, unknown>
  formConfig: Record<string, unknown>
}

interface UseFormEventsParams {
  typeCode: string
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
}

export const useFormEvents = ({
  typeCode,
  attributes,
  form,
}: UseFormEventsParams) => {
  const eventFieldMap = useMemo(
    () =>
      new Map(
        attributes
          .filter((attr) => attr.formEvent)
          .map((attr) => [attr.code, attr.formEvent!])
      ),
    [attributes]
  )

  const { mutate } = useMutation({
    mutationFn: (payload: HandleEventPayload) =>
      apiService.post<HandleEventResponse>({
        url: `/api/document-entries/${typeCode}/handle-event`,
        data: payload,
      }),
    onSuccess: (response) => {
      const newAttributes = response.data.attributes as
        | Record<string, unknown>
        | undefined
      if (!newAttributes) return

      for (const [key, value] of Object.entries(newAttributes)) {
        form.setValue(key, value)
      }
    },
  })

  const onFieldChange = useCallback(
    (fieldCode: string) => {
      const eventName = eventFieldMap.get(fieldCode)
      if (!eventName) return

      mutate({
        eventName,
        entry: form.getValues(),
      })
    },
    [eventFieldMap, mutate, form]
  )

  return { onFieldChange }
}
