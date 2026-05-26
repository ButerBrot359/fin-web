import type { ApiResponse } from '@/shared/types/api.types'

/**
 * Вид счёта — аналог 1С ВидСчета.
 * ACTIVE / PASSIVE / ACTIVE_PASSIVE.
 */
export type AccountType = 'ACTIVE' | 'PASSIVE' | 'ACTIVE_PASSIVE'

/**
 * Признаки вида субконто на счёте — аналог 1С ПризнакиСубконто:
 * ТолькоОбороты / Суммовой / Количественный / Валютный.
 */
export interface SubcontoLink {
  /** Ссылка на CharacteristicsPlan-элемент (вид субконто). */
  subcontoTypeId: number | null
  /** Денормализованное имя вида субконто (с бэка для list/card). */
  subcontoTypeNameRu?: string
  subcontoTypeNameKz?: string
  /** Только обороты — учёт без остатков. */
  onlyTurnovers: boolean
  /** Учёт суммовой. */
  summable: boolean
  /** Учёт количественный. */
  quantitative: boolean
  /** Учёт валютный. */
  currency: boolean
}

/** Запись плана счетов — аналог ПланСчетов.Хозрасчетный.Элемент. */
export interface AccountPlanEntry {
  id: number
  /** Код счёта (например, "10.01"). */
  code: string
  nameRu: string
  nameKz: string
  accountType: AccountType
  /** Признак валютного счёта (на уровне счёта). */
  isCurrency: boolean
  /** Признак количественного учёта. */
  isQuantitative: boolean
  /** Забалансовый. */
  isOffBalance: boolean
  /** Родитель — для иерархии (группа счетов). */
  parentId: number | null
  /** Группа ли (промежуточный узел дерева). */
  isGroup: boolean
  /** До 3 видов субконто. */
  subcontoList: SubcontoLink[]
  /** Произвольные атрибуты — для совместимости с EAV-таблицей. */
  attributes?: Record<string, unknown> | null
}

export interface AccountPlanCreatePayload {
  code: string
  nameRu: string
  nameKz?: string
  accountType: AccountType
  isCurrency: boolean
  isQuantitative: boolean
  isOffBalance: boolean
  parentId?: number | null
  isGroup?: boolean
  subcontoList: SubcontoLink[]
}

export type AccountPlanResponseData = ApiResponse<AccountPlanEntry>

/** Вид характеристики (Субконто). */
export interface SubcontoType {
  id: number
  code: string
  nameRu: string
  nameKz: string
  /** Тип значения субконто (DICTIONARY / DOCUMENT / etc). */
  valueType?: string
}

export type SubcontoTypesResponseData = ApiResponse<{ content: SubcontoType[] }>
