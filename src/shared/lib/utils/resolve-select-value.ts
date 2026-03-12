import type { SelectOption } from '@/shared/types/select-option'

export const resolveSelectValue = (
  raw: unknown,
  options: SelectOption[]
): SelectOption | null => {
  if (!raw || typeof raw !== 'object' || !('id' in raw)) return null

  const obj = raw as Record<string, unknown>

  const found = options.find((opt) => opt.id === obj.id)
  if (found) return found

  return {
    id: obj.id as number,
    code: typeof obj.code === 'string' ? obj.code : '',
    label:
      typeof obj.nameRu === 'string'
        ? obj.nameRu
        : typeof obj.name === 'string'
          ? obj.name
          : '',
    raw: obj,
  }
}
