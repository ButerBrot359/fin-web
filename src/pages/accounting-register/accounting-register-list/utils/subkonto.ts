import type { AccountingRegisterEntry } from '../types/accounting-register'

/** Разрешённая ссылка субконто: тип значения + ID объекта-ссылки. */
export interface SubkontoRef {
  valueType: string
  /** ID объекта по соответствующему `*ReferenceId` (или enum value id). */
  refId: number | null
}

interface SubkontoItem {
  side?: string
  position?: number
  valueType?: string
  dictionaryEntryReferenceId?: number | null
  documentEntryReferenceId?: number | null
  accountPlanEntryReferenceId?: number | null
  characteristicsPlanEntryReferenceId?: number | null
  calculationPlanEntryReferenceId?: number | null
  exchangePlanEntryReferenceId?: number | null
  accumulationRegisterEntryReferenceId?: number | null
  informationRegisterEntryReferenceId?: number | null
  accountingRegisterEntryReferenceId?: number | null
  enumsValueId?: number | null
}

const REF_ID_FIELDS: (keyof SubkontoItem)[] = [
  'dictionaryEntryReferenceId',
  'documentEntryReferenceId',
  'accountPlanEntryReferenceId',
  'characteristicsPlanEntryReferenceId',
  'calculationPlanEntryReferenceId',
  'exchangePlanEntryReferenceId',
  'accumulationRegisterEntryReferenceId',
  'informationRegisterEntryReferenceId',
  'accountingRegisterEntryReferenceId',
  'enumsValueId',
]

/**
 * Достаёт ссылку субконто из массива записи `subkontosDt` / `subkontosKt`
 * (по позиции 1..3 и стороне Дт/Кт). Значение субконто — ID объекта-ссылки
 * (а не готовый объект); резолв ID → имя делает вызывающая ячейка.
 */
export const getSubkontoRef = (
  row: AccountingRegisterEntry,
  position: number,
  side: 'Dt' | 'Kt'
): SubkontoRef | null => {
  const arr = row[side === 'Dt' ? 'subkontosDt' : 'subkontosKt']
  if (!Array.isArray(arr)) return null

  const item = (arr as SubkontoItem[]).find((s) => s.position === position)
  if (!item) return null

  for (const field of REF_ID_FIELDS) {
    const v = item[field]
    if (typeof v === 'number') {
      return { valueType: item.valueType ?? '', refId: v }
    }
  }
  return { valueType: item.valueType ?? '', refId: null }
}
