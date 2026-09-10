import type {
  AiAssistantCapability,
  AiAssistantContext,
} from '@/entities/ai-assistant'
import type { TranslationKey } from '@/shared/types/i18n.types'

import { DEFAULT_CAPABILITIES } from './capability-catalog'

type ContextKind = AiAssistantContext['kind']

/** Готовая формулировка: короткая подпись на кнопке и полный вопрос под ней. */
export interface AssistantPreset {
  id: string
  labelKey: TranslationKey
  /** Уходит помощнику. Полнее подписи: «Объяснить итог» модели ничего не говорит. */
  promptKey: TranslationKey
  /** Без этого разрешения заготовка гарантированно упрётся в отказ сервера. */
  capability: AiAssistantCapability
  kinds: ContextKind[]
  /** Нужен сохранённый объект, а не только его тип. */
  requiresEntry?: boolean
}

/**
 * Заготовки — по положению, в котором открыт помощник.
 *
 * <p>Прежние три вопроса показывались только над открытым документом, и в списке,
 * в справочнике или просто на главной панель встречала пустым полем ввода. Пустое
 * поле — худшая подсказка: человек не знает, каким языком с помощником говорить,
 * и уходит, не спросив ничего.
 *
 * <p>Формулировки намеренно законченные. Заготовка вида «Добавь строку…», которую
 * нужно дописывать, экономит меньше, чем стоит сбитый ход мысли.
 */
const PRESETS: AssistantPreset[] = [
  // --- открыт конкретный документ
  {
    id: 'explain-total',
    labelKey: 'aiAssistant.quickExplainTotal',
    promptKey: 'aiAssistant.presetExplainTotalPrompt',
    capability: 'SEARCH_DATA',
    kinds: ['DOCUMENT'],
    requiresEntry: true,
  },
  {
    id: 'check-document',
    labelKey: 'aiAssistant.quickCheckDocument',
    promptKey: 'aiAssistant.presetCheckDocumentPrompt',
    capability: 'SEARCH_DATA',
    kinds: ['DOCUMENT'],
    requiresEntry: true,
  },
  {
    id: 'movements',
    labelKey: 'aiAssistant.presetMovements',
    promptKey: 'aiAssistant.presetMovementsPrompt',
    capability: 'READ_MOVEMENTS',
    kinds: ['DOCUMENT'],
    requiresEntry: true,
  },
  {
    // Самая частая просьба над открытым документом: «сделай такой же, но за другой
    // период». Помощник собирает её из чтения контекста и создания — отдельного
    // действия «копировать» у него нет.
    id: 'copy-document',
    labelKey: 'aiAssistant.presetCopyDocument',
    promptKey: 'aiAssistant.presetCopyDocumentPrompt',
    capability: 'CREATE_DOCUMENT',
    kinds: ['DOCUMENT'],
    requiresEntry: true,
  },
  {
    id: 'compare-period',
    labelKey: 'aiAssistant.quickComparePeriod',
    promptKey: 'aiAssistant.presetComparePeriodPrompt',
    capability: 'SEARCH_DATA',
    kinds: ['DOCUMENT'],
    requiresEntry: true,
  },

  // --- список документов и новая карточка: вид известен, записи ещё нет
  {
    id: 'month-documents',
    labelKey: 'aiAssistant.presetMonthDocuments',
    promptKey: 'aiAssistant.presetMonthDocumentsPrompt',
    capability: 'SEARCH_DATA',
    kinds: ['DOCUMENT_LIST'],
  },
  {
    id: 'unposted-of-type',
    labelKey: 'aiAssistant.presetUnposted',
    promptKey: 'aiAssistant.presetUnpostedPrompt',
    capability: 'SEARCH_DATA',
    kinds: ['DOCUMENT_LIST'],
  },
  {
    id: 'required-fields',
    labelKey: 'aiAssistant.presetRequiredFields',
    promptKey: 'aiAssistant.presetRequiredFieldsPrompt',
    capability: 'SEARCH_DATA',
    kinds: ['DOCUMENT_LIST', 'DOCUMENT_NEW'],
  },
  {
    // Помощник заполняет не открытую форму, а создаёт новый документ и открывает
    // его — своего «заполни то, что передо мной» у него нет.
    id: 'copy-last-month',
    labelKey: 'aiAssistant.presetCopyLastMonth',
    promptKey: 'aiAssistant.presetCopyLastMonthPrompt',
    capability: 'CREATE_DOCUMENT',
    kinds: ['DOCUMENT_LIST', 'DOCUMENT_NEW'],
  },

  // --- справочники
  {
    // Одна заготовка, и та про записи: реквизиты справочника помощник прочитать не
    // может (таких видов чтения у него нет), а поиск по справочнику не умеет
    // сортировать по дате добавления. Заготовка «последние записи» заставила бы
    // модель выдать первые попавшиеся за последние.
    id: 'dictionary-entries',
    labelKey: 'aiAssistant.presetDictionaryEntries',
    promptKey: 'aiAssistant.presetDictionaryEntriesPrompt',
    capability: 'SEARCH_DATA',
    kinds: ['DICTIONARY', 'DICTIONARY_LIST'],
  },

  // --- ничего не открыто: вопросы, которым контекст не нужен
  {
    // Первым — именно стандартный отчёт: он даёт те же числа, что человек видит
    // на экране, а расчёт по витринам ниже — свой, и сойтись с отчётом обязан,
    // но проверить это может только сам человек.
    id: 'report',
    labelKey: 'aiAssistant.presetReport',
    promptKey: 'aiAssistant.presetReportPrompt',
    capability: 'RUN_REPORT',
    kinds: ['NONE'],
  },
  {
    id: 'balances',
    labelKey: 'aiAssistant.presetBalances',
    promptKey: 'aiAssistant.presetBalancesPrompt',
    capability: 'QUERY_TOTALS',
    kinds: ['NONE'],
  },
  {
    id: 'turnovers',
    labelKey: 'aiAssistant.presetTurnovers',
    promptKey: 'aiAssistant.presetTurnoversPrompt',
    capability: 'QUERY_TOTALS',
    kinds: ['NONE'],
  },
  {
    id: 'unposted-all',
    labelKey: 'aiAssistant.presetUnpostedAll',
    promptKey: 'aiAssistant.presetUnpostedAllPrompt',
    capability: 'SEARCH_DATA',
    kinds: ['NONE'],
  },
]

/**
 * Больше четырёх в панель шириной 26rem не помещается, не съедая ленту диалога.
 * Отбор идёт сверху вниз, поэтому в каждой группе первыми стоят самые частые.
 */
const MAX_PRESETS = 4

/**
 * Документ без записи — это список: адрес формы списка и адрес несохранённой
 * карточки различаются не всегда, и спрашивать «из чего сложился итог» там не о чем.
 */
const normalizeKind = (context: AiAssistantContext): ContextKind =>
  context.kind === 'DOCUMENT' && context.entryId == null
    ? 'DOCUMENT_LIST'
    : context.kind

/**
 * Заготовки, которые здесь и сейчас сработают.
 *
 * @param capabilities `null` — настройки ещё не приехали; берём набор по умолчанию,
 *        то есть только читающие заготовки. Пустая панель хуже, чем панель с
 *        безопасным минимумом, а выключенное чтение — редкость.
 */
export const selectPresets = (
  context: AiAssistantContext,
  capabilities: AiAssistantCapability[] | null
): AssistantPreset[] => {
  const allowed = capabilities ?? DEFAULT_CAPABILITIES
  const kind = normalizeKind(context)

  return PRESETS.filter(
    (preset) =>
      preset.kinds.includes(kind) &&
      allowed.includes(preset.capability) &&
      (!preset.requiresEntry || context.entryId != null)
  ).slice(0, MAX_PRESETS)
}
