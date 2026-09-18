import type { AiAssistantCapability } from '@/entities/ai-assistant'
import type { TranslationKey } from '@/shared/types/i18n.types'

/** Одно разрешение: как называется, что означает и как о нём попросить. */
export interface CapabilityDescriptor {
  value: AiAssistantCapability
  labelKey: TranslationKey
  hintKey: TranslationKey
  /** Живая фраза, которой этого просят. Справка её же и отправляет помощнику. */
  exampleKey: TranslationKey
  /** Действие меняет учёт, а не готовит данные — помечается красным. */
  critical?: boolean
  requires?: AiAssistantCapability[]
}

/**
 * Разрешения помощника — один список на настройки и на справку.
 *
 * <p>Раньше перечень жил внутри формы галочек. Справка, объясняющая пользователю
 * возможности, обязана перечислять ровно то же самое: два независимых списка
 * разъезжаются на первом же добавленном действии, и тогда справка начинает обещать
 * несуществующее или умалчивать о работающем.
 *
 * <p>Порядок не алфавитный, а по нарастанию последствий: сначала чтение, затем
 * запись, затем то, что трогает учёт. Так галочка, которую опасно ставить не глядя,
 * оказывается внизу, а не между двумя безобидными.
 */
export const READ_CAPABILITIES: CapabilityDescriptor[] = [
  {
    value: 'READ_RELATED_DOCUMENTS',
    requires: ['SEARCH_DATA'],
    labelKey: 'aiAssistant.capRelated',
    hintKey: 'aiAssistant.capRelatedHint',
    exampleKey: 'aiAssistant.capRelatedExample',
  },
  {
    value: 'CHECK_DOCUMENT',
    labelKey: 'aiAssistant.capCheck',
    hintKey: 'aiAssistant.capCheckHint',
    exampleKey: 'aiAssistant.capCheckExample',
  },
  {
    value: 'BATCH_CHECK_DOCUMENTS',
    labelKey: 'aiAssistant.capBatchCheck',
    hintKey: 'aiAssistant.capBatchCheckHint',
    exampleKey: 'aiAssistant.capBatchCheckExample',
    requires: ['CHECK_DOCUMENT', 'SEARCH_DATA'],
  },
  {
    value: 'DRILLDOWN_REPORT',
    labelKey: 'aiAssistant.capDrilldown',
    hintKey: 'aiAssistant.capDrilldownHint',
    exampleKey: 'aiAssistant.capDrilldownExample',
    requires: ['RUN_REPORT', 'SEARCH_DATA'],
  },
  {
    value: 'EXPORT_REPORT',
    labelKey: 'aiAssistant.capExportReport',
    hintKey: 'aiAssistant.capExportReportHint',
    exampleKey: 'aiAssistant.capExportReportExample',
    requires: ['RUN_REPORT'],
  },
  {
    value: 'COMPARE_WITH_1C',
    labelKey: 'aiAssistant.capCompare1c',
    hintKey: 'aiAssistant.capCompare1cHint',
    exampleKey: 'aiAssistant.capCompare1cExample',
  },

  {
    value: 'SEARCH_DATA',
    labelKey: 'aiAssistant.capSearch',
    hintKey: 'aiAssistant.capSearchHint',
    exampleKey: 'aiAssistant.capSearchExample',
  },
  {
    value: 'QUERY_TOTALS',
    labelKey: 'aiAssistant.capTotals',
    hintKey: 'aiAssistant.capTotalsHint',
    exampleKey: 'aiAssistant.capTotalsExample',
  },
  {
    value: 'READ_MOVEMENTS',
    labelKey: 'aiAssistant.capMovements',
    hintKey: 'aiAssistant.capMovementsHint',
    exampleKey: 'aiAssistant.capMovementsExample',
  },
  {
    value: 'RUN_REPORT',
    labelKey: 'aiAssistant.capReports',
    hintKey: 'aiAssistant.capReportsHint',
    exampleKey: 'aiAssistant.capReportsExample',
  },
  {
    // Печать ничего не меняет и в модель ничего не отправляет — потому и в этой
    // группе. Своя галочка всё равно есть: что помощнику позволено, решает
    // организация, а не мы за неё.
    value: 'PRINT_DOCUMENT',
    labelKey: 'aiAssistant.capPrint',
    hintKey: 'aiAssistant.capPrintHint',
    exampleKey: 'aiAssistant.capPrintExample',
  },
]

export const WRITE_CAPABILITIES: CapabilityDescriptor[] = [
  {
    value: 'CREATE_FROM_BASIS',
    labelKey: 'aiAssistant.capBasis',
    hintKey: 'aiAssistant.capBasisHint',
    exampleKey: 'aiAssistant.capBasisExample',
    requires: ['CREATE_DOCUMENT'],
  },
  {
    value: 'FILL_DOCUMENT',
    labelKey: 'aiAssistant.capFill',
    hintKey: 'aiAssistant.capFillHint',
    exampleKey: 'aiAssistant.capFillExample',
    requires: ['UPDATE_DOCUMENT'],
  },
  {
    value: 'CALCULATE_DOCUMENT',
    labelKey: 'aiAssistant.capCalculate',
    hintKey: 'aiAssistant.capCalculateHint',
    exampleKey: 'aiAssistant.capCalculateExample',
    requires: ['UPDATE_DOCUMENT'],
  },
  {
    value: 'EDIT_DOCUMENT_ROWS',
    labelKey: 'aiAssistant.capEditRows',
    hintKey: 'aiAssistant.capEditRowsHint',
    exampleKey: 'aiAssistant.capEditRowsExample',
    requires: ['UPDATE_DOCUMENT'],
  },
  {
    value: 'DELETE_DOCUMENT_ROWS',
    labelKey: 'aiAssistant.capDeleteRows',
    hintKey: 'aiAssistant.capDeleteRowsHint',
    exampleKey: 'aiAssistant.capDeleteRowsExample',
    requires: ['EDIT_DOCUMENT_ROWS', 'UPDATE_DOCUMENT'],
    critical: true,
  },

  {
    value: 'CREATE_DOCUMENT',
    labelKey: 'aiAssistant.capCreateDocument',
    hintKey: 'aiAssistant.capCreateDocumentHint',
    exampleKey: 'aiAssistant.capCreateDocumentExample',
  },
  {
    value: 'UPDATE_DOCUMENT',
    labelKey: 'aiAssistant.capUpdateDocument',
    hintKey: 'aiAssistant.capUpdateDocumentHint',
    exampleKey: 'aiAssistant.capUpdateDocumentExample',
  },
  {
    value: 'CREATE_DICTIONARY_ENTRY',
    labelKey: 'aiAssistant.capCreateDictionary',
    hintKey: 'aiAssistant.capCreateDictionaryHint',
    exampleKey: 'aiAssistant.capCreateDictionaryExample',
  },
  {
    value: 'UPDATE_DICTIONARY_ENTRY',
    labelKey: 'aiAssistant.capUpdateDictionary',
    hintKey: 'aiAssistant.capUpdateDictionaryHint',
    exampleKey: 'aiAssistant.capUpdateDictionaryExample',
  },
  {
    value: 'POST_DOCUMENT',
    labelKey: 'aiAssistant.capPost',
    hintKey: 'aiAssistant.capPostHint',
    exampleKey: 'aiAssistant.capPostExample',
    critical: true,
  },
  {
    value: 'UNPOST_DOCUMENT',
    labelKey: 'aiAssistant.capUnpost',
    hintKey: 'aiAssistant.capUnpostHint',
    exampleKey: 'aiAssistant.capUnpostExample',
    critical: true,
  },
  {
    value: 'DELETE_DOCUMENT',
    labelKey: 'aiAssistant.capDelete',
    hintKey: 'aiAssistant.capDeleteHint',
    exampleKey: 'aiAssistant.capDeleteExample',
    critical: true,
  },
]

/**
 * Что включено, пока организация ничего не выбирала.
 *
 * Повторяет `AiAssistantCapability.defaults()` на сервере — здесь набор нужен как
 * запасной, когда настройки ещё не приехали: показать заготовки, которые почти
 * наверняка сработают, лучше, чем пустое место.
 */
export const DEFAULT_CAPABILITIES: AiAssistantCapability[] = [
  'SEARCH_DATA',
  'QUERY_TOTALS',
]

/** Составные операции доступны только вместе с базовыми разрешениями. */
export const isCapabilityAllowed = (
  capability: AiAssistantCapability,
  allowed: readonly AiAssistantCapability[]
): boolean => {
  const descriptor = [...READ_CAPABILITIES, ...WRITE_CAPABILITIES].find(
    (row) => row.value === capability
  )
  return (
    allowed.includes(capability) &&
    (descriptor?.requires ?? []).every((required) => allowed.includes(required))
  )
}
