import type { DocumentAttribute } from '@/entities/document-type'
import type { FieldFilter } from '@/entities/form-config'
import { resolveAttributeDomain } from '@/shared/lib/consts/data-types'

/**
 * Фронтовый фолбэк серверных `fieldFilters`, которые конфиг-сервис пока не
 * отдаёт. Декларативно: какие ссылочные типы ограничиваются значением поля
 * шапки. Значение берётся ЖИВЫМ из формы (реактивно), поэтому корректно при
 * смене «Организации» и не зависит от экземпляра документа — в отличие от
 * «запечённого» в статический конфиг id.
 *
 * Когда бэк начнёт присылать `fieldFilters` — серверные значения имеют
 * приоритет, а эту карту можно удалить.
 */
const ORG_SCOPED_REFERENCE_TYPES: Record<
  string,
  { sourceField: string; targetAttribute: string }
> = {
  // МОЛ (физлица) ограничиваются физлицами «Организации» документа.
  FizicheskieLitsa: {
    sourceField: 'Organizatsiya',
    targetAttribute: 'Organizatsiya',
  },
}

const getRule = (attribute: DocumentAttribute) => {
  const resolved = resolveAttributeDomain(attribute)
  return resolved ? ORG_SCOPED_REFERENCE_TYPES[resolved.typeCode] : undefined
}

/** Поле-источник (в шапке), от которого зависит фильтр поля, либо `undefined`. */
export const getOrgScopeSourceField = (
  attribute: DocumentAttribute
): string | undefined => getRule(attribute)?.sourceField

/**
 * Синтезирует фильтр ссылочного поля из живого значения поля-источника.
 * `readSource(code)` — текущее значение поля шапки (объект `{ id }`).
 * Возвращает `undefined`, если правило не применимо или источник не выбран
 * (тогда отбор не накладывается — показываем всех).
 */
export const synthesizeReferenceFilter = (
  attribute: DocumentAttribute | undefined,
  readSource: (code: string) => unknown
): FieldFilter | undefined => {
  if (!attribute) return undefined
  const rule = getRule(attribute)
  if (!rule) return undefined
  const source = readSource(rule.sourceField) as
    | { id?: number | string }
    | null
    | undefined
  if (source?.id == null) return undefined
  return { attributeEquals: { [rule.targetAttribute]: source.id } }
}
