import type { FieldNode as FieldNodeType } from '@/entities/form-config'
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
import { mapDataType } from '../lib/utils/map-data-type'

const LEGACY_MAP: Record<string, string> = {
  reference: 'dict',
  dictionary: 'dict',
  select: 'enum',
  date: 'datetime',
  decimal: 'number',
}

interface FieldNodeProps {
  node: FieldNodeType
}

export const FieldNode = ({ node }: FieldNodeProps) => {
  const { attributeMap, form, readOnly, language, optionsMap } =
    useFormRendererContext()
  const attribute = attributeMap.get(node.code)

  const label =
    node.label ??
    (attribute
      ? language === 'kz'
        ? attribute.nameKz || attribute.nameRu
        : attribute.nameRu
      : node.code)

  const raw =
    node.fieldType ?? (attribute ? mapDataType(attribute.dataType) : 'text')
  const fieldType = LEGACY_MAP[raw] ?? raw

  const commonProps = {
    name: node.code,
    label,
    control: form.control,
    readOnly,
  }

  const options = optionsMap[node.code] ?? []

  const wrapper = (content: React.ReactNode) => (
    <div style={{ flex: node.flex }}>{content}</div>
  )

  const getTypeCode = () =>
    attribute?.referenceTypeCode ??
    (attribute?.allowedTypes as { typeCode: string }[] | undefined)?.[0]
      ?.typeCode ??
    ''

  switch (fieldType) {
    case 'text':
      return wrapper(<TextField {...commonProps} />)
    case 'number':
      return wrapper(
        <NumberField
          {...commonProps}
          decimal={attribute?.dataType === 'DECIMAL'}
        />
      )
    case 'textarea':
      return wrapper(<TextareaField {...commonProps} />)
    case 'checkbox':
      return wrapper(<CheckboxField {...commonProps} />)
    case 'datetime':
      return wrapper(
        <DateTimeField
          {...commonProps}
          dateOnly={attribute?.dataType === 'DATE'}
        />
      )
    case 'dict':
      return wrapper(
        <DictField
          {...commonProps}
          options={options}
          referenceTypeCode={getTypeCode() || undefined}
        />
      )
    case 'enum':
      return wrapper(
        <EnumField {...commonProps} enumTypeCode={getTypeCode()} />
      )
    default:
      return wrapper(<TextField {...commonProps} />)
  }
}
