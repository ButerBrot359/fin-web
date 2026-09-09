import type { LlmProvider } from '@/entities/analytics'
import type { TranslationKey } from '@/shared/types/i18n.types'

interface ProviderOption {
  value: LlmProvider
  /** Ключ i18n; подписи провайдеров лежат в `analytics.settings.provider*`. */
  labelKey: TranslationKey
  /**
   * Адрес провайдера по умолчанию — подпись на карточке выбора. Хост во всех
   * языках одинаковый, это технический идентификатор, а не текст интерфейса,
   * поэтому в i18n он не заводится. Пустое поле «Адрес API» означает именно
   * этот хост.
   *
   * `null` — адреса по умолчанию не существует (своя модель): вместо хоста
   * карточка показывает переводимую подпись, потому что это уже текст
   * интерфейса, а не идентификатор.
   */
  host: string | null
}

export const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'ANTHROPIC',
    labelKey: 'analytics.settings.providerAnthropic',
    host: 'api.anthropic.com',
  },
  {
    value: 'OPENAI',
    labelKey: 'analytics.settings.providerOpenai',
    host: 'api.openai.com',
  },
  {
    value: 'OPENROUTER',
    labelKey: 'analytics.settings.providerOpenrouter',
    host: 'openrouter.ai',
  },
  {
    value: 'LOCAL',
    labelKey: 'analytics.settings.providerLocal',
    host: null,
  },
]

/**
 * Значения формы, когда настроек ещё нет (первый вход в организацию или
 * бэкенд недоступен). Температура низкая: ассистент строит SQL и спецификацию,
 * разброс ответов здесь вреден.
 */
export const DEFAULT_PROVIDER: LlmProvider = 'ANTHROPIC'
export const DEFAULT_TEMPERATURE = 0.2
export const DEFAULT_MAX_TOKENS = 8192

export const TEMPERATURE_MIN = 0
export const TEMPERATURE_MAX = 1
export const TEMPERATURE_STEP = 0.1

export const MAX_TOKENS_MIN = 256
export const MAX_TOKENS_MAX = 200_000
