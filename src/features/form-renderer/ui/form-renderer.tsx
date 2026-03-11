import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { UseFormReturn } from 'react-hook-form'

import type { FormConfig } from '@/entities/form-config'
import type {
  DocumentAttribute,
  OnGetFormField,
} from '@/entities/document-type'

import { FormRendererContext } from '../lib/hooks/use-form-renderer-context'
import { useFieldOptions } from '../lib/hooks/use-field-options'
import { NodeRenderer } from './node-renderer'

interface FormRendererProps {
  config: FormConfig
  attributes: DocumentAttribute[]
  form: UseFormReturn<Record<string, unknown>>
  readOnly?: boolean
  onGetFormData?: OnGetFormField[]
}

export const FormRenderer = ({
  config,
  attributes,
  form,
  readOnly = false,
  onGetFormData,
}: FormRendererProps) => {
  const { i18n } = useTranslation()
  const { optionsMap } = useFieldOptions({ attributes, onGetFormData })

  const contextValue = useMemo(
    () => ({
      attributeMap: new Map(attributes.map((attr) => [attr.code, attr])),
      form,
      readOnly,
      language: i18n.language,
      optionsMap,
    }),
    [attributes, form, readOnly, i18n.language, optionsMap]
  )

  return (
    <FormRendererContext value={contextValue}>
      <NodeRenderer node={config.layout} />
    </FormRendererContext>
  )
}
