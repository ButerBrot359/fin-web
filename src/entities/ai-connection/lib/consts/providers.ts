import type { LlmProvider } from '@/entities/analytics'
import type { TranslationKey } from '@/shared/types/i18n.types'

export interface ProviderOption {
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

/**
 * Реестр ИИ-провайдеров — один на оба контура: настройки аналитики и
 * подключения помощника показывают один и тот же список.
 */
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
