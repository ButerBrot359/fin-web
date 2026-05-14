import { useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import type { FormConfig } from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'

import { FormRendererContext } from '../lib/hooks/use-form-renderer-context'
import { useFieldOptions } from '../lib/hooks/use-field-options'
import { useFormEvents } from '../lib/hooks/use-form-events'
import { useTypeDependencies } from '../lib/hooks/use-type-dependencies'
import { NodeRenderer } from './node-renderer'

interface FormRendererProps {
  config: FormConfig
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  typeCode: string
}

export const FormRenderer = ({
  config,
  attributes,
  form,
  typeCode,
}: FormRendererProps) => {
  const { i18n } = useTranslation()
  const { dependencyMap } = useTypeDependencies({ attributes })
  const { optionsMap } = useFieldOptions({ attributes, dependencyMap })

  const tableReplacersRef = useRef(
    new Map<string, (rows: Record<string, unknown>[]) => void>()
  )

  const registerTableReplacer = useCallback(
    (code: string, replacer: (rows: Record<string, unknown>[]) => void) => {
      tableReplacersRef.current.set(code, replacer)
    },
    []
  )

  const unregisterTableReplacer = useCallback((code: string) => {
    tableReplacersRef.current.delete(code)
  }, [])

  const { onFieldChange } = useFormEvents({
    typeCode,
    attributes,
    form,
    tableReplacersRef,
  })

  const contextValue = useMemo(
    () => ({
      attributeMap: new Map(attributes.map((attr) => [attr.code, attr])),
      form,
      language: i18n.language,
      optionsMap,
      onFieldChange,
      dependencyMap,
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
