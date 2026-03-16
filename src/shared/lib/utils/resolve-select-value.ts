import i18n from '@/app/config/i18n'
import type { SelectOption } from '@/shared/types/select-option'

const resolveLabel = (obj: Record<string, unknown>): string => {
  if (typeof obj.displayName === 'string' && obj.displayName)
    return obj.displayName
  if (typeof obj.name === 'string' && obj.name) return obj.name

  const isKz = i18n.language === 'kz'
  const nameKz = typeof obj.nameKz === 'string' ? obj.nameKz : ''
  const nameRu = typeof obj.nameRu === 'string' ? obj.nameRu : ''

  return (isKz ? nameKz || nameRu : nameRu || nameKz) || ''
}

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
    label: resolveLabel(obj),
    raw: obj,
  }
}
