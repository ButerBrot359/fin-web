import type { OsvReportEntry } from '../types/osv-report'

/**
 * Цель команды «Открыть <элемент>» (как в 1С) для строки ОСВ: карточка
 * элемента справочника или документа. `null` — у этой строки открывать нечего
 * (строка-счёт, группа «Без значения», субконто без резолвленного типа).
 */
export interface OpenTarget {
  kind: 'dictionary' | 'document'
  /** Код типа справочника/документа — сегмент маршрута. */
  typeCode: string
  /** ID записи-элемента. */
  id: number
  /** Имя элемента для подписи пункта меню (может отсутствовать). */
  name?: string
}

/**
 * Уровень группировки ОСВ (`groupLevel`) → код справочника-источника.
 * Значения совпадают с `dictTypeCode` из REPORT_FILTER_DIMENSIONS
 * (features/report-settings) — держим в синхроне при изменениях там.
 */
const GROUP_LEVEL_TO_DICT: Record<string, string | undefined> = {
  ORGANIZATION: 'Organizatsii',
  PODRAZDELENIE: 'PodrazdeleniyaOrganizatsiy',
  FKR: 'FunktsionalnayaKlassifikatsiyaRaskhodov',
  SPETSIFIKA: 'EkonomicheskayaKlassifikatsiyaRaskhodov',
  ISTOCHNIK_FINANSIROVANIYA: 'VidyIstochnikovFinansirovaniya',
  KOD_PLATNYKH_USLUG: 'KlassifikatorKodovPlatnykhUslug',
}

/**
 * Определяет, карточку какого элемента открывать по строке ОСВ.
 *
 * - Лист-субконто: справочник (`dictionaryTypeCode` + `dictionaryEntryReferenceId`)
 *   или документ (`documentTypeCode` + `documentEntryReferenceId`). Коды типов
 *   присылает бэк (иначе маршрут не собрать → `null`).
 * - Узел-измерение (Организация/Подразделение/ФКР/…): справочник по
 *   `groupLevel` → код + `groupRefId`.
 * - Строка-счёт / группа «Без значения» → `null` (для счёта есть «Карточка счёта»).
 */
export const resolveOpenTarget = (node: OsvReportEntry): OpenTarget | null => {
  const sub = node.subkonto
  if (sub) {
    const name = sub.displayName ?? sub.nameRu ?? sub.code ?? undefined
    if (sub.dictionaryEntryReferenceId != null && sub.dictionaryTypeCode) {
      return {
        kind: 'dictionary',
        typeCode: sub.dictionaryTypeCode,
        id: sub.dictionaryEntryReferenceId,
        name,
      }
    }
    if (sub.documentEntryReferenceId != null && sub.documentTypeCode) {
      return {
        kind: 'document',
        typeCode: sub.documentTypeCode,
        id: sub.documentEntryReferenceId,
        name,
      }
    }
    return null
  }

  if (node.groupLevel && node.groupRefId != null) {
    const typeCode = GROUP_LEVEL_TO_DICT[node.groupLevel]
    if (typeCode) {
      return {
        kind: 'dictionary',
        typeCode,
        id: node.groupRefId,
        name: node.groupRefName ?? undefined,
      }
    }
  }
  return null
}
