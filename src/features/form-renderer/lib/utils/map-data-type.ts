import type { FieldType } from '@/entities/form-config'

const DATA_TYPE_MAP: Record<string, FieldType> = {
  STRING: 'text',
  INTEGER: 'number',
  DECIMAL: 'number',
  BOOLEAN: 'checkbox',
  DATE: 'datetime',
  DATETIME: 'datetime',
  TEXT: 'textarea',
  DICTIONARY: 'dict',
  REFERENCE: 'dict',
  ACCOUNT_PLAN: 'dict',
  ENUM: 'enum',
  ENUMS: 'enum',
}

export const mapDataType = (dataType: string): FieldType =>
  DATA_TYPE_MAP[dataType] ?? 'text'
