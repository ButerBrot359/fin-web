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
export const aiSettingsSchema = z.object({
  provider: z.enum(['ANTHROPIC', 'OPENAI', 'OPENROUTER']),
  model: z.string().trim().min(1, 'errors.required'),
  /** Пусто — стандартный адрес провайдера. */
  baseUrl: z.string(),
  /** Пусто — оставить сохранённый на сервере ключ. */
  apiKey: z.string(),
  temperature: z.number().min(TEMPERATURE_MIN).max(TEMPERATURE_MAX),
  maxTokens: z.number().int().min(MAX_TOKENS_MIN).max(MAX_TOKENS_MAX),
  enabled: z.boolean(),
})

export type AiSettingsFormValues = z.infer<typeof aiSettingsSchema>
