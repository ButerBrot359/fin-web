export const getDisplayValue = (value: unknown, language: string): string => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  if (typeof value !== 'object') return ''
  const obj = value as Record<string, unknown>
  const name =
    language === 'kz' && typeof obj.nameKz === 'string'
      ? obj.nameKz
      : typeof obj.nameRu === 'string'
        ? obj.nameRu
        : typeof obj.name === 'string'
          ? obj.name
          : ''
  return name
}
