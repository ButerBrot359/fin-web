/**
 * Реальные DTO плана счетов — из ответов API (см. fixtures/).
 * Имена полей и регистр копируются 1-в-1: бэк отдаёт непоследовательный
 * camelCase ('accountplanTypeCode' vs 'accountPlanEntryId',
 * 'code1C' vs 'kindCode1c'), и менять это здесь нельзя.
 */

export type AccountType = 'A' | 'P' | 'AP'

export type CharacteristicValueKind =
  | 'DICTIONARY'
  | 'ENUMS'
  | 'DOCUMENT'
  | 'COMPOSITE'
  | 'PRIMITIVE'

export type PrimitiveType = 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN'

/** Обёртка ответа для одиночного ресурса: GET /entries/{id}. */
export interface ApiSingleResponse<T> {
  data: T
  success: boolean
}

/** Обёртка ответа для коллекции: GET /entries, /subkonto-kinds. */
export interface ApiListResponse<T> {
  list: T[]
  totalSize: number
}

/** Карточка счёта (расширенный DTO). */
export interface AccountPlanEntryDto {
  id: number
  // Регистр — как в JSON: маленькая «plan».
  accountplanTypeCode: string
  accountplanTypeCode1C: string | null
  code: string
  // Большая «C» — отличается от kindCode1c в субконто.
  code1C: string | null
  predefinedName: string | null
  predefinedName1C: string | null
  nameRu: string
  // Сейчас бэк отдаёт null — фолбэк на nameRu делает UI.
  nameKz: string | null
  displayName: string
  parentId: number | null
  parentName: string | null
  sortOrder: number
  isActive: boolean
  accountType: AccountType
  isCurrency: boolean
  isQuantity: boolean
  isOffBalance: boolean
  isGroup: boolean
  createdAt: string | null
  updatedAt: string | null
  deletedAt: string | null
  createdBy: string | null
  updatedBy: string | null
  attributes: Record<string, unknown>
  children: AccountPlanEntryDto[] | null
}

/** Элемент compositeTargets[]: targetNameKz в данных отсутствует. */
export interface CompositeTarget {
  position: number
  targetKind: 'DICTIONARY' | 'DOCUMENT' | 'ENUMS'
  targetId: number
  targetCode: string
  targetNameRu: string
}

/** Вид субконто, привязанный к счёту (до 3 на счёт). */
export interface AccountPlanSubkontoKindDto {
  id: number
  // Регистр — как в JSON: большая «Plan».
  accountPlanEntryId: number
  position: 1 | 2 | 3
  kindId: number
  kindCode: string
  // Маленькая «c» — отличается от code1C в карточке.
  kindCode1c: string
  kindNameRu: string
  kindNameKz: string | null
  valueKind: CharacteristicValueKind

  valueDictionaryTypeId: number | null
  valueDictionaryTypeCode: string | null

  valueEnumsTypeId: number | null
  valueEnumsTypeCode: string | null

  valueDocumentTypeId: number | null
  valueDocumentTypeCode: string | null

  valuePrimitiveType: PrimitiveType | null

  compositeTargets: CompositeTarget[] | null

  isOnlyTurnover: boolean
  isSummary: boolean
  isCurrency: boolean
  isQuantity: boolean
}

/** Виды субконто из плана видов характеристик (для селекта в карточке). */
export interface SubcontoBuType {
  id: number
  code: string
  nameRu: string
  nameKz: string | null
  valueKind?: CharacteristicValueKind
}

/** Payload create/update — поднимаем то, что бэк ждёт в теле. */
export interface AccountPlanEntryPayload {
  code: string
  nameRu: string
  nameKz?: string | null
  accountType: AccountType
  isCurrency: boolean
  isQuantity: boolean
  isOffBalance: boolean
  isGroup: boolean
  parentId: number | null
  /** EAV-атрибуты: код атрибута -> значение (бэк сохраняет в AccountPlanValue). */
  attributes?: Record<string, unknown>
}
