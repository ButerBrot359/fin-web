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
   * `true` — колонка опциональная (NULL допустим), `false` — обязательная.
   * `undefined` трактуется как `true` — защита от старого кэша/прокси.
   */
  nullable?: boolean
}

export type EavColumnsResponseData = ApiResponse<ColumnMetaDto[]>

export type EavSearchResponseData<T> = ApiResponse<PagedResponse<T>>
