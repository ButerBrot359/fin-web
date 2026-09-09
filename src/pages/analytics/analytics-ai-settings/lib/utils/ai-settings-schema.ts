import { z } from 'zod'

import {
  MAX_TOKENS_MAX,
  MAX_TOKENS_MIN,
  TEMPERATURE_MAX,
  TEMPERATURE_MIN,
} from '../consts/providers'

/**
 * Схема формы настроек ИИ.
 *
 * Сообщения — ключи i18n, а не текст: их прогоняет через `t()` поле ввода.
 * Диапазоны температуры и лимита токенов гарантирует сама форма (слайдер и
 * зажатый инпут), поэтому текста ошибки у них нет — сработать они не могут.
 */
const baseSchema = z.object({
  provider: z.enum(['ANTHROPIC', 'OPENAI', 'OPENROUTER', 'LOCAL']),
  model: z.string().trim().min(1, 'errors.required'),
  /** Пусто — стандартный адрес провайдера; для своей модели обязателен. */
  baseUrl: z.string(),
  /** Пусто — оставить сохранённый на сервере ключ. */
  apiKey: z.string(),
  temperature: z.number().min(TEMPERATURE_MIN).max(TEMPERATURE_MAX),
  maxTokens: z.number().int().min(MAX_TOKENS_MIN).max(MAX_TOKENS_MAX),
  enabled: z.boolean(),
})

/**
 * У своей модели адрес обязателен: дефолтного хоста у неё нет, и пустое поле
 * означало бы «некуда обращаться». Проверка межполевая, поэтому живёт в
 * `superRefine`, а не в самом поле.
 */
export const aiSettingsSchema = baseSchema.superRefine((values, ctx) => {
  if (values.provider === 'LOCAL' && values.baseUrl.trim() === '') {
    ctx.addIssue({
      code: 'custom',
      path: ['baseUrl'],
      message: 'analytics.settings.baseUrlRequiredLocal',
    })
  }
})

export type AiSettingsFormValues = z.infer<typeof baseSchema>
