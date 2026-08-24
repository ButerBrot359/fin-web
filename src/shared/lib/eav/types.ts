import type { ApiResponse, PagedResponse } from '@/shared/types/api.types'
import type { DataType } from '@/shared/lib/consts/data-types'

export type FilterOp =
  | 'eq'
  | 'ne'
  | 'contains'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'notIn'
  | 'isNull'
  | 'isNotNull'

export type LogicOperator = 'AND' | 'OR'

export interface FilterCondition {
  field: string
  op: FilterOp
  value?: unknown
}

export interface FilterRequest {
  filters: FilterCondition[]
  logic: LogicOperator
  /**
   * Строка быстрого поиска (SCRUM-360 §2): бэк ищет вхождением по колонкам
   * списка. Читается ТОЛЬКО из тела POST /search; домены без
   * `supportsQSearch` (регистры) на `q` в теле отвечают HTTP 400.
   */
  q?: string
}

export interface ColumnMetaDto {
  code: string
  nameRu: string
  nameKz?: string | null
  dataType: DataType
  isSystem: boolean
  referencedTypeCode: string | null
  referencedDomainKind: string | null
  allowedOps: FilterOp[] | null
  /**
   * Предвыбранный оператор фильтра (SCRUM-360 §4): строковые → `contains`,
   * прочие → `eq`. Всегда входит в `allowedOps`; `null` — фильтрация по
   * колонке запрещена. Опциональное: старый кэш/прокси могут не прислать.
   */
  defaultOp?: FilterOp | null
  /**
   * `true` — колонка опциональная (NULL допустим), `false` — обязательная.
   * `undefined` трактуется как `true` — защита от старого кэша/прокси.
   */
  nullable?: boolean
}

export type EavColumnsResponseData = ApiResponse<ColumnMetaDto[]>

export type EavSearchResponseData<T> = ApiResponse<PagedResponse<T>>
