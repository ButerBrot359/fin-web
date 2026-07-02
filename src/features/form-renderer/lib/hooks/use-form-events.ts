import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'

import { apiService } from '@/shared/api/api'
import type { DocumentAttribute } from '@/entities/document-type'

import type { TableReplacersRef } from '../../types/renderer-context'

interface HandleEventPayload {
  eventName: string
  entry: Record<string, unknown>
  /**
   * Сидинг видимости при открытии формы (§5 SCRUM-263): из ответа применяется
   * только `formConfig.visibility`, `attributes` игнорируются — иначе replace
   * таблиц пометил бы только что открытый документ как изменённый.
   */
  seedOnly?: boolean
}

interface HandleEventResponse {
  data: {
    attributes: Record<string, unknown>
    formConfig: Record<string, unknown>
  }
}

interface UseFormEventsParams {
  typeCode: string
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  tableReplacersRef: TableReplacersRef
  /** Динамическая видимость из `formConfig.visibility` ответа handle-event. */
  onVisibility?: (visibility: Record<string, boolean>) => void
}

export const useFormEvents = ({
  typeCode,
  attributes,
  form,
  tableReplacersRef,
  onVisibility,
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

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: HandleEventPayload) =>
      apiService.post<HandleEventResponse>({
        url: `/api/document-entries/${typeCode}/handle-event`,
        data: { eventName: payload.eventName, entry: payload.entry },
      }),
    onSuccess: (response, variables) => {
      const formConfig = response.data.data.formConfig as
        | { visibility?: Record<string, boolean> }
        | undefined
      if (formConfig?.visibility && onVisibility) {
        onVisibility(formConfig.visibility)
      }

      if (variables.seedOnly) return

      const newAttributes = response.data.data.attributes as
        | Record<string, unknown>
        | undefined

      if (!newAttributes) return

      for (const [key, value] of Object.entries(newAttributes)) {
        const replacer = tableReplacersRef.current.get(key)
        if (replacer && Array.isArray(value)) {
          replacer(value as Record<string, unknown>[])
        } else {
          form.setValue(key, value)
        }
      }
    },
  })

  // Сидинг начальной видимости (§5 SCRUM-263): handle-event присылает
  // visibility только при изменении поля, поэтому у сохранённого документа
  // с заполненным полем-триггером карта была бы пустой до первого касания.
  // Значения существующей записи попадают в форму через form.reset в эффекте
  // родителя (после маунта), поэтому ждём их через подписку form.watch и при
  // первом появлении значения у поля с formEvent один раз шлём его событие
  // (seedOnly — применяется только видимость). Если первым пришло реальное
  // редактирование пользователя (type === 'change'), сидинг не нужен —
  // обычный onFieldChange сам обновит видимость.
  const seededRef = useRef(false)

  useEffect(() => {
    if (seededRef.current || eventFieldMap.size === 0) return

    const seedIfReady = (values: Record<string, unknown>): boolean => {
      for (const [fieldCode, eventName] of eventFieldMap) {
        const value = values[fieldCode]
        if (value !== undefined && value !== null && value !== '') {
          seededRef.current = true
          mutate({ eventName, entry: { attributes: values }, seedOnly: true })
          return true
        }
      }
      return false
    }

    if (seedIfReady(form.getValues())) return

    const subscription = form.watch((values, info) => {
      if (seededRef.current) return
      if (info.type === 'change') {
        seededRef.current = true
        return
      }
      seedIfReady(values as Record<string, unknown>)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, [eventFieldMap, form, mutate])

  const onFieldChange = useCallback(
    (fieldCode: string) => {
      const eventName = eventFieldMap.get(fieldCode)
      if (!eventName) return

      mutate({
        eventName,
        entry: { attributes: form.getValues() },
      })
    },
    [eventFieldMap, mutate, form]
  )

  const triggerEvent = useCallback(
    (eventName: string) => {
      mutate({
        eventName,
        entry: { attributes: form.getValues() },
      })
    },
    [mutate, form]
  )

  return { onFieldChange, triggerEvent, isPending }
}
