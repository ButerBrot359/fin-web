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
]

export const WRITE_CAPABILITIES: CapabilityDescriptor[] = [
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
