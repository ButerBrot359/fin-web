import { useTranslation } from 'react-i18next'

import type { FieldNode as FieldNodeType } from '@/entities/form-config'
import {
  IGNORED_DATA_TYPES,
  DICT_DATA_TYPES,
  getSearchUrl,
} from '@/shared/lib/consts/data-types'
import {
  TextField,
  NumberField,
  EnumField,
  DictField,
  CheckboxField,
  DateTimeField,
  TextareaField,
} from '@/shared/ui/form-fields'

import { useFormRendererContext } from '../lib/hooks/use-form-renderer-context'

interface FieldNodeProps {
  node: FieldNodeType
}

export const FieldNode = ({ node }: FieldNodeProps) => {
  const { t } = useTranslation()
  const { attributeMap, form, readOnly, language, optionsMap } =
    useFormRendererContext()
  const attribute = attributeMap.get(node.code)

  if (!attribute) return null

  const { dataType } = attribute

  if (IGNORED_DATA_TYPES.has(dataType)) return null

  const label =
    node.label ??
    (language === 'kz'
      ? attribute.nameKz || attribute.nameRu
      : attribute.nameRu)

  const required = attribute.isRequired ? t('errors.required') : undefined

  const commonProps = {
    name: node.code,
    label,
    control: form.control,
    readOnly,
    required,
  }

  const getTypeCode = () =>
    attribute.referenceTypeCode ??
    (attribute.allowedTypes as { typeCode: string }[] | undefined)?.[0]
      ?.typeCode ??
    ''

  const renderField = () => {
    if (DICT_DATA_TYPES.has(dataType)) {
      const typeCode = getTypeCode()
      const searchUrl = typeCode
        ? (getSearchUrl(dataType, typeCode) ?? undefined)
        : undefined

      return (
        <DictField
          {...commonProps}
          options={optionsMap[node.code] ?? []}
          searchUrl={searchUrl}
        />
      )
    }

    switch (dataType) {
      case 'STRING':
        return <TextField {...commonProps} />
      case 'TEXT':
        return <TextareaField {...commonProps} />
      case 'INTEGER':
      case 'DECIMAL':
        return <NumberField {...commonProps} decimal={dataType === 'DECIMAL'} />
      case 'BOOLEAN':
        return <CheckboxField {...commonProps} />
      case 'DATE':
      case 'DATETIME':
        return <DateTimeField {...commonProps} dateOnly={dataType === 'DATE'} />
      case 'ENUMS':
        return <EnumField {...commonProps} enumTypeCode={getTypeCode()} />
      default:
        return <TextField {...commonProps} />
    }
  }

  return <div style={{ flex: node.flex }}>{renderField()}</div>
}
