import axios from 'axios'

import type { ApiErrorBody } from '@/shared/types/auth.types'

/**
 * Текст отказа во входе.
 *
 * Сообщение берётся с сервера и показывается ДОСЛОВНО. Оно уже обезличено намеренно: на
 * «логина нет», «пароль неверен», «войти по паролю нельзя» и «пароль не задан» сервер
 * отвечает одним и тем же текстом, чтобы перебором нельзя было выяснить, какие учётные
 * записи существуют. Пытаться уточнить причину на клиенте нечем и не нужно — это не
 * недоработка бэкенда, а требование (ТЗ «Аутентификация» §А1).
 *
 * @param fallback локализованный текст на случай, когда ответа нет вовсе (сеть, таймаут):
 *                 тела с сообщением в этой ситуации не существует.
 */
export const extractAuthError = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) return fallback

  const body = error.response?.data as Partial<ApiErrorBody> | undefined
  return typeof body?.message === 'string' && body.message.length > 0
    ? body.message
    : fallback
}
