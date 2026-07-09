import type { DocumentAttribute } from '@/entities/document-type'
import type { FieldFilter } from '@/entities/form-config'
import { resolveAttributeDomain } from '@/shared/lib/consts/data-types'

interface ScopeRule {
  sourceField: string
  targetAttribute: string
}

/**
 * Фронтовый фолбэк серверных `fieldFilters`, которые конфиг-сервис пока не
 * отдаёт. Декларативно: какими значениями полей шапки ограничивается выбор
 * ссылочного типа. Значения берутся ЖИВЫМИ из формы (реактивно), поэтому
 * корректны при смене источника и не зависят от экземпляра документа — в
 * отличие от «запечённого» в статический конфиг id. Правил у типа может быть
 * несколько — тогда условия объединяются по И (все должны совпасть).
 *
 * Когда бэк начнёт присылать `fieldFilters` — серверные значения имеют
 * приоритет, а эту карту можно удалить.
 */
const ORG_SCOPED_REFERENCE_TYPES: Record<string, ScopeRule[]> = {
  // МОЛ (физлица) ограничиваются физлицами «Организации» документа.
  FizicheskieLitsa: [
    { sourceField: 'Organizatsiya', targetAttribute: 'Organizatsiya' },
  ],
  // «Договор контрагента» ограничивается договорами выбранного «Контрагента»:
  // Vladelets (владелец договора) = Контрагент документа. По организации НЕ
  // фильтруем — договор привязан к контрагенту через владельца, а реквизит
  // «Организация» у договора часто не заполнен (строгий отбор по нему скрыл бы
  // валидные договоры). Отбор применяется и к выпадашке, и к пикеру «Показать все».
  DogovoryKontragentov: [
    { sourceField: 'Kontragent', targetAttribute: 'Vladelets' },
  ],
}

const getRules = (attribute: DocumentAttribute): ScopeRule[] | undefined => {
  const resolved = resolveAttributeDomain(attribute)
  return resolved ? ORG_SCOPED_REFERENCE_TYPES[resolved.typeCode] : undefined
}

/** Поля-источники (в шапке), от которых зависит фильтр поля (без повторов). */
export const getOrgScopeSourceFields = (
  attribute: DocumentAttribute
): string[] => {
  const rules = getRules(attribute)
  if (!rules) return []
  return [...new Set(rules.map((r) => r.sourceField))]
}

/**
 * Синтезирует фильтр ссылочного поля из живых значений полей-источников.
 * `readSource(code)` — текущее значение поля шапки (объект `{ id }`).
 * Условие по правилу добавляется только если его источник выбран; если ни один
 * источник не выбран — возвращает `undefined` (отбор не накладывается — показываем всех).
 */
export const synthesizeReferenceFilter = (
  attribute: DocumentAttribute | undefined,
  readSource: (code: string) => unknown
): FieldFilter | undefined => {
  if (!attribute) return undefined
  const rules = getRules(attribute)
  if (!rules) return undefined
  const attributeEquals: Record<string, number | string> = {}
  for (const rule of rules) {
    const source = readSource(rule.sourceField) as
      | { id?: number | string }
      | null
      | undefined
    if (source?.id != null) {
      attributeEquals[rule.targetAttribute] = source.id
    }
  }
  return Object.keys(attributeEquals).length > 0
    ? { attributeEquals }
    : undefined
}
