import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import type { FormConfig } from '@/entities/form-config'
import type { DocumentAttribute } from '@/entities/document-type'

import { FormRendererContext } from '../lib/hooks/use-form-renderer-context'
import { useFieldOptions } from '../lib/hooks/use-field-options'
import { useFormEvents } from '../lib/hooks/use-form-events'
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
  const { optionsMap } = useFieldOptions({ attributes })

  const { onFieldChange } = useFormEvents({ typeCode, attributes, form })

  const contextValue = useMemo(
    () => ({
      attributeMap: new Map(attributes.map((attr) => [attr.code, attr])),
      form,
      language: i18n.language,
      optionsMap,
      onFieldChange,
    }),
    [attributes, form, i18n.language, optionsMap, onFieldChange]
  )

  return (
    <FormRendererContext value={contextValue}>
      <NodeRenderer node={config.layout} />
    </FormRendererContext>
  )
}
