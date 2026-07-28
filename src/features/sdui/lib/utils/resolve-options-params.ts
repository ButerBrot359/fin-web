export type OptionsParamValue = string | { fromBinding: string }

function isFromBinding(v: unknown): v is { fromBinding: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    'fromBinding' in v &&
    typeof (v as { fromBinding: unknown }).fromBinding === 'string'
  )
}

/**
 * Резолвит `optionsSource.params` в плоские query-параметры, не зная бизнес-смысла.
 * - строка → как есть;
 * - `{ fromBinding }` → значение поля формы по binding: объект с `id` → String(id),
 *   иначе примитив → String(value); пустое/null → параметр опускается (нет фильтра);
 * - прочие типы значений игнорируются (не улетают как `[object Object]`).
 */
export function resolveOptionsParams(
  params: Record<string, OptionsParamValue> | undefined,
  getValue: (binding: string) => unknown,
): Record<string, string> {
  const result: Record<string, string> = {}
  if (!params) return result

  for (const [key, raw] of Object.entries(params)) {
    if (typeof raw === 'string') {
      result[key] = raw
      continue
    }
    if (isFromBinding(raw)) {
      const fieldValue = getValue(raw.fromBinding)
      const resolved = extractParamValue(fieldValue)
      if (resolved != null) result[key] = resolved
    }
  }

  return result
}

function isStringifiable(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
}

function extractParamValue(fieldValue: unknown): string | null {
  if (fieldValue == null) return null
  if (typeof fieldValue === 'object') {
    const id = (fieldValue as { id?: unknown }).id
    return isStringifiable(id) ? String(id) : null
  }
  return isStringifiable(fieldValue) ? String(fieldValue) : null
}
