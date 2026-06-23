import { useRef, useMemo, useCallback, useEffect } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import type { FormConfig } from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'

import { FormRendererContext } from '../lib/hooks/use-form-renderer-context'
import { useFieldOptions } from '../lib/hooks/use-field-options'
import { useFormEvents } from '../lib/hooks/use-form-events'
import { useTypeDependencies } from '../lib/hooks/use-type-dependencies'
import { NodeRenderer } from './node-renderer'

export interface FormRendererHandle {
  triggerEvent(eventName: string): void
  clearAllTables(): void
}

const EMPTY_FIELD_FILTERS: NonNullable<FormConfig['fieldFilters']> = {}

interface FormRendererProps {
  config: FormConfig
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  typeCode: string
  handleRef?: RefObject<FormRendererHandle | null>
  sharedTableReplacersRef?: RefObject<Map<string, (rows: Record<string, unknown>[]) => void>>
}

export const FormRenderer = ({
  config,
  attributes,
  form,
  typeCode,
  handleRef,
  sharedTableReplacersRef,
}: FormRendererProps) => {
  const { i18n } = useTranslation()
  const { dependencyMap } = useTypeDependencies({ attributes })
  const { optionsMap } = useFieldOptions({ attributes, dependencyMap })

  const localTableReplacersRef = useRef(
    new Map<string, (rows: Record<string, unknown>[]) => void>()
  )

  const tableReplacersRef = sharedTableReplacersRef ?? localTableReplacersRef

  const registerTableReplacer = useCallback(
    (code: string, replacer: (rows: Record<string, unknown>[]) => void) => {
      tableReplacersRef.current.set(code, replacer)
    },
    [tableReplacersRef]
  )

  const unregisterTableReplacer = useCallback(
    (code: string) => {
      tableReplacersRef.current.delete(code)
    },
    [tableReplacersRef]
  )

  const { onFieldChange, triggerEvent } = useFormEvents({
    typeCode,
    attributes,
    form,
    tableReplacersRef,
  })

  const clearAllTables = useCallback(() => {
    for (const replacer of tableReplacersRef.current.values()) {
      replacer([])
    }
  }, [tableReplacersRef])

  useEffect(() => {
    if (!handleRef) return
    handleRef.current = { triggerEvent, clearAllTables }
    return () => {
      handleRef.current = null
    }
  }, [handleRef, triggerEvent, clearAllTables])

  const fieldFilters = config.fieldFilters ?? EMPTY_FIELD_FILTERS

  const contextValue = useMemo(
    () => ({
      attributeMap: new Map(attributes.map((attr) => [attr.code, attr])),
      form,
      language: i18n.language,
      optionsMap,
      onFieldChange,
      dependencyMap,
      fieldFilters,
      registerTableReplacer,
      unregisterTableReplacer,
    }),
    [
      attributes,
      form,
      i18n.language,
      optionsMap,
      onFieldChange,
      dependencyMap,
      fieldFilters,
      registerTableReplacer,
      unregisterTableReplacer,
    ]
  )

  return (
    <FormRendererContext value={contextValue}>
      <NodeRenderer node={config.layout} />
    </FormRendererContext>
  )
}
