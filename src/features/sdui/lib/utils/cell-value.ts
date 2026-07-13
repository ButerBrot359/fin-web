/**
 * If value is an object with a `presentation` field, return it as string.
 * Otherwise return String(value ?? '').
 */
export function renderCellValue(value: unknown): string {
  if (value !== null && typeof value === 'object' && 'presentation' in value) {
    return String((value as Record<string, unknown>).presentation ?? '')
  }
  return String(value ?? '')
}

/**
 * If value is an object with an `id` field, return the id.
 * Otherwise return value as-is.
 */
export function normalizeKey(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && 'id' in value) {
    return (value as Record<string, unknown>).id
  }
  return value
}
