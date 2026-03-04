import type { FieldNode as FieldNodeType } from '@/entities/form-config'
import {
  TextField,
  NumberField,
  SelectField,
  ReferenceField,
  DateTimeField,
  TextareaField,
} from '@/shared/ui/form-fields'

import { useFormRendererContext } from '../lib/hooks/use-form-renderer-context'
import { mapDataType } from '../lib/utils/map-data-type'

interface FieldNodeProps {
  node: FieldNodeType
}

export const FieldNode = ({ node }: FieldNodeProps) => {
  const { attributeMap, form, readOnly, language } = useFormRendererContext()
  const attribute = attributeMap.get(node.code)

  const label =
    node.label ??
    (attribute
      ? language === 'kz'
        ? attribute.nameKz || attribute.nameRu
        : attribute.nameRu
      : node.code)

  const fieldType =
    node.fieldType ?? (attribute ? mapDataType(attribute.dataType) : 'text')

  const commonProps = {
    name: node.code,
    label,
    control: form.control,
    readOnly,
  }

  const wrapper = (content: React.ReactNode) => (
    <div style={{ flex: node.flex }}>{content}</div>
  )

  switch (fieldType) {
    case 'text':
      return wrapper(<TextField {...commonProps} />)
    case 'number':
      return wrapper(<NumberField {...commonProps} />)
    case 'decimal':
      return wrapper(<NumberField {...commonProps} decimal />)
    case 'select':
      return wrapper(<SelectField {...commonProps} />)
    case 'reference':
      return wrapper(<ReferenceField {...commonProps} />)
    case 'datetime':
      return wrapper(<DateTimeField {...commonProps} />)
    case 'date':
      return wrapper(<DateTimeField {...commonProps} dateOnly />)
    case 'textarea':
      return wrapper(<TextareaField {...commonProps} />)
    case 'checkbox':
      return wrapper(<TextField {...commonProps} />)
    default:
      return wrapper(<TextField {...commonProps} />)
  }
}
