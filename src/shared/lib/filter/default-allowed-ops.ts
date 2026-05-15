/**
 * Дефолтные наборы операторов фильтрации по типу данных.
 *
 * ВРЕМЕННЫЙ FALLBACK на gap бэка Phase 1: для EAV-атрибутов
 * `allowedOps` приходит как null. В Phase 2 бэка должны
 * заполняться явно из `/columns`, после чего эти дефолты можно
 * будет удалить и трактовать null как «фильтрация запрещена».
 *
 * Контракт сейчас:
 * - `null` от бэка       → fallback на DEFAULT_ALLOWED_OPS[dataType]
 * - явный массив от бэка → авторитет (даже если пустой)
 * - неизвестный dataType → пустой массив → иконка фильтра не рендерится
 *
 * TODO(phase-2-backend): убрать fallback, как только бэк начнёт
 * возвращать allowedOps для EAV-атрибутов.
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

export const resolveAllowedOps = (
  dataType: DataType,
  allowedOpsFromBackend: FilterOp[] | null
): readonly FilterOp[] => {
  if (allowedOpsFromBackend !== null) return allowedOpsFromBackend
  return DEFAULT_ALLOWED_OPS[dataType]
}
