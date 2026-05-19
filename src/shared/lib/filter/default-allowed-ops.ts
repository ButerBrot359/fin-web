/**
 * Дефолтные наборы операторов фильтрации по типу данных.
 *
 * ВРЕМЕННЫЙ FALLBACK на gap бэка Phase 1: для EAV-атрибутов
 * `allowedOps` приходит как null. В Phase 2 бэка должны
 * заполняться явно из `/columns`, после чего эти дефолты можно
 * будет удалить и трактовать null как «фильтрация запрещена».
 *
 * Контракт сейчас:
 * - `null` или пустой массив от бэка → fallback на DEFAULT_ALLOWED_OPS[dataType]
 * - непустой массив от бэка          → авторитет
 * - неизвестный dataType / тип без поддержки → пустой массив → иконка не рендерится
 *
 * Fallback также для пустого массива нужен потому, что бэк сейчас
 * возвращает `allowedOps: []` для системных колонок (например,
 * `isPosted: BOOLEAN`), хотя сами операторы поддержаны DSL.
 *
 * TODO(phase-2-backend): убрать fallback, как только бэк начнёт
 * возвращать корректный allowedOps для всех колонок (EAV + системных).
 */
import type { DataType } from '@/shared/lib/consts/data-types'
import type { FilterOp } from '@/entities/document-entry'

export const DEFAULT_ALLOWED_OPS = {
  STRING: ['eq', 'ne', 'contains', 'isNull', 'isNotNull'],
  TEXT: ['eq', 'ne', 'contains', 'isNull', 'isNotNull'],
  INTEGER: [
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'in',
    'notIn',
    'isNull',
    'isNotNull',
  ],
  DECIMAL: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  DATE: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  DATETIME: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'isNull', 'isNotNull'],
  BOOLEAN: ['eq', 'ne', 'isNull', 'isNotNull'],
  DICTIONARY: ['eq', 'ne', 'in', 'notIn', 'isNull', 'isNotNull'],
  ENUMS: ['eq', 'ne', 'in', 'notIn', 'isNull', 'isNotNull'],
  DOCUMENT: ['eq', 'ne', 'in', 'notIn', 'isNull', 'isNotNull'],
  ACCOUNT_PLAN: ['eq', 'ne', 'in', 'notIn', 'isNull', 'isNotNull'],
  CHARACTERISTICS_PLAN: ['eq', 'ne', 'in', 'notIn', 'isNull', 'isNotNull'],
  EXCHANGE_PLAN: ['eq', 'ne', 'in', 'notIn', 'isNull', 'isNotNull'],
  CALCULATION_PLAN: ['eq', 'ne', 'in', 'notIn', 'isNull', 'isNotNull'],
  ACCUMULATION_REGISTER: [],
  INFORMATION_REGISTER: [],
  OBJECT: [],
  TABLE: [],
} as const satisfies Record<DataType, readonly FilterOp[]>

/**
 * SEMANTIC NOTE (Phase 1): пустой массив `[]` и `null` сейчас эквивалентны —
 * оба триггерят fallback на DEFAULT_ALLOWED_OPS. Это вынужденно, потому что
 * бэк отдаёт `[]` для системных колонок (например, `isPosted: BOOLEAN`).
 *
 * В Phase 2 бэка контракт должен расщепить эти случаи:
 *   - `null` → бэк не заполнил (использовать default)
 *   - `[]`   → бэк явно запретил фильтрацию (прятать иконку)
 * Тогда условие тут поменяется на `allowedOpsFromBackend !== null`.
 * См. gap бэка #8.
 *
 * Дополнительно: для DATETIME выкидываем `eq`/`ne` даже если бэк их
 * прислал — фильтр-UI рендерит только дату (без time-picker'а), а
 * exact-instant-match по началу суток бесполезен.
 */
const DATETIME_HIDDEN_OPS = new Set<FilterOp>(['eq', 'ne'])

export const resolveAllowedOps = (
  dataType: DataType,
  allowedOpsFromBackend: FilterOp[] | null
): readonly FilterOp[] => {
  const base =
    allowedOpsFromBackend && allowedOpsFromBackend.length > 0
      ? allowedOpsFromBackend
      : DEFAULT_ALLOWED_OPS[dataType]
  if (dataType === 'DATETIME') {
    return base.filter((op) => !DATETIME_HIDDEN_OPS.has(op))
  }
  return base
}
