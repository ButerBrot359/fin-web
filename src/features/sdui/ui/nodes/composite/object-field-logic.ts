/**
 * Чистая логика OBJECT_FIELD (SCRUM-268 §3.2).
 *
 * Развилка имён (§2.5 контракта): DomainKind во ВХОДЯЩЕМ значении лежит под
 * ключом `domain`, в ИСХОДЯЩЕМ — под ключом `type`. Виджет не читает ни то,
 * ни другое: из входящего значения читается ТОЛЬКО `targetTypeCode` — он
 * round-trip'ится и различает same-domain членов (Владелец: Организации |
 * Контрагенты — оба DICTIONARY).
 */

export interface ObjectValue {
  id: number
  presentation: string
  /** DomainKind — только ПИШЕТСЯ при эмите. Из входящего значения не читается. */
  type?: string
  targetTypeCode: string
}

export interface AllowedType {
  position: number
  domainKind: string
  targetTypeCode: string
  presentation: string
  optionsSource?: { url: string; params?: Record<string, string> }
}

export function sortAllowedTypes(types: AllowedType[]): AllowedType[] {
  return [...types].sort((a, b) => a.position - b.position)
}

export function findAllowedType(
  allowedTypes: AllowedType[],
  typeCode: string | undefined,
): AllowedType | undefined {
  if (!typeCode) return undefined
  return allowedTypes.find((t) => t.targetTypeCode === typeCode)
}

/**
 * Приоритет: targetTypeCode из значения (если он ∈ allowedTypes) →
 * ручной выбор пользователя → первый член (allowedTypes уже отсортированы).
 */
export function resolveSelectedTypeCode(
  allowedTypes: AllowedType[],
  value: ObjectValue | null | undefined,
  userTypeCode: string | undefined,
): string | undefined {
  if (value?.targetTypeCode && findAllowedType(allowedTypes, value.targetTypeCode)) {
    return value.targetTypeCode
  }
  if (findAllowedType(allowedTypes, userTypeCode)) {
    return userTypeCode
  }
  return allowedTypes[0]?.targetTypeCode
}

export function buildObjectValue(
  member: AllowedType,
  option: { id: number | string; label: string },
): ObjectValue {
  return {
    id: Number(option.id),
    presentation: option.label,
    type: member.domainKind,
    targetTypeCode: member.targetTypeCode,
  }
}
