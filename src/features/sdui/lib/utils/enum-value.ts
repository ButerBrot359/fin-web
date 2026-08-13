export interface EnumOption {
  value: string
  label: string
  id?: number
  code?: string
}

/** Текущее значение enum (строка-код или объект `{id, code, presentation}`) → строковый `value` опции. */
export function resolveEnumValue(
  value: unknown,
  options: EnumOption[]
): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as { id?: unknown; code?: unknown }
    const match = options.find(
      (o) =>
        (v.id != null && o.id === v.id) || (v.code != null && o.code === v.code)
    )
    return match?.value ?? ''
  }
  return ''
}
