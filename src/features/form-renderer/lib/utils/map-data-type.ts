import type { FieldType } from '@/entities/form-config'

const DATA_TYPE_MAP: Record<string, FieldType> = {
  STRING: 'text',
  INTEGER: 'number',
  DECIMAL: 'decimal',
  BOOLEAN: 'checkbox',
  DATE: 'date',
  DATETIME: 'datetime',
  TEXT: 'textarea',
  DICTIONARY: 'reference',
  REFERENCE: 'reference',
  ENUM: 'select',
}

export const mapDataType = (dataType: string): FieldType =>
  DATA_TYPE_MAP[dataType] ?? 'text'
