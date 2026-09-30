import { translateUi } from '@/shared/lib/i18n'

const notes: Partial<Record<string, string>> = {
  REQUEST_UNITS_DIFFER: 'Контуры используют разные единицы запросов.',
  ASSISTANT_REQUEST_IS_USER_MESSAGE:
    'Запрос помощнику — сообщение пользователя.',
  ANALYTICS_REQUEST_IS_LLM_STAGE: 'Запрос аналитики — отдельный вызов модели.',
  ANALYTICS_INCLUDES_TEST_REQUESTS: 'Аналитика включает проверки подключения.',
  ACTIONS_ARE_AUDIT_ATTEMPTS: 'Действия учитывают попытки, включая ошибки.',
  ACTUAL_BILLING_UNAVAILABLE: 'Фактический счёт провайдера недоступен.',
  COST_IS_SAVED_SNAPSHOT:
    'Стоимость сохранена при вызове ИИ. Изменения тарифов не пересчитывают историю.',
  COST_REQUIRES_COMPLETE_COVERAGE:
    'Стоимость доступна только при полном покрытии тарифов и токенов.',
  USER_ATTRIBUTION_INCOMPLETE:
    'Часть обращений не связана с пользователем; число пользователей может быть неполным.',
  CONVERSATION_ATTRIBUTION_INCOMPLETE:
    'Часть обращений не связана с диалогом; число диалогов может быть неполным.',
  TOKEN_USAGE_INCOMPLETE:
    'Для части обращений расход токенов неизвестен; итог может быть неполным.',
  LATENCY_EXCLUDES_UNKNOWN_ZERO:
    'Неизвестная и нулевая длительность исключена из показателей времени.',
  MODELS_LIMITED_TO_TOP_100:
    'Таблица ограничена 100 наиболее используемыми моделями.',
}

export const formatStatisticsNote = (
  code: string,
  language: string
): string | null => {
  const note = notes[code]
  return note ? translateUi(note, language) : null
}
