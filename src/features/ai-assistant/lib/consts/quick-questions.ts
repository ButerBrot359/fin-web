import type { TranslationKey } from '@/shared/types/i18n.types'

/**
 * Готовые команды панели.
 *
 * Ровно три и ровно эти: концепция рекомендует начать первый релиз с них
 * («Объяснить итог», «Проверить начисление», «Сравнить с прошлым месяцем») и
 * подключать остальное после проверки качества ответов. Длинный список готовых
 * вопросов на непроверенной модели создаёт впечатление возможностей, которых
 * ещё нет.
 *
 * Показываются только при открытом документе: без него отвечать не на чем.
 */
export const QUICK_QUESTION_KEYS: TranslationKey[] = [
  'aiAssistant.quickExplainTotal',
  'aiAssistant.quickCheckDocument',
  'aiAssistant.quickComparePeriod',
]
