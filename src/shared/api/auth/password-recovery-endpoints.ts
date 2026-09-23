import axios from 'axios'

import type {
  LoginOptions,
  PasswordRecoveryAck,
  PasswordRecoveryTicket,
} from '@/shared/types/auth.types'

/**
 * Анонимный контур входа (SCRUM-355 §2.1–2.2): настройки экрана входа и
 * восстановление пароля. Токена на этих экранах нет — инстанс голый, без
 * auth-интерсепторов, по той же причине, что и в auth-endpoints.ts.
 */
const anonymousInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

const RECOVERY_BASE = '/api/auth/password-recovery'

/** Что показывать на экране входа. Зовётся при монтировании страницы логина. */
export const requestLoginOptions = async (): Promise<LoginOptions> => {
  const { data } = await anonymousInstance.get<LoginOptions>(
    '/api/auth/login-options'
  )
  return data
}

/**
 * Шаг 1: запросить письмо. Ответ ВСЕГДА 200 и одинаков для существующего и
 * несуществующего адреса (страница не должна работать перечислителем учётных
 * записей) — из ответа и задержки ничего не выводим, текст показываем как есть.
 */
export const requestPasswordRecovery = async (
  email: string
): Promise<PasswordRecoveryAck> => {
  const { data } = await anonymousInstance.post<PasswordRecoveryAck>(
    `${RECOVERY_BASE}/request`,
    { email }
  )
  return data
}

/** Шаг 2а: код из письма → тикет. 401 = код неверен/просрочен/использован. */
export const verifyPasswordRecoveryCode = async (
  email: string,
  code: string
): Promise<PasswordRecoveryTicket> => {
  const { data } = await anonymousInstance.post<PasswordRecoveryTicket>(
    `${RECOVERY_BASE}/verify`,
    { email, code }
  )
  return data
}

/** Шаг 2б: переход по ссылке из письма → тикет. 401 = ссылка недействительна. */
export const verifyPasswordRecoveryLink = async (
  token: string
): Promise<PasswordRecoveryTicket> => {
  const { data } = await anonymousInstance.post<PasswordRecoveryTicket>(
    `${RECOVERY_BASE}/verify-link`,
    { token }
  )
  return data
}

/**
 * Шаг 3: задать пароль. Тело ответа ПУСТОЕ (`ResponseEntity<Void>`) — не
 * разбираем как JSON. После 200 все сессии отозваны: вызывающий уводит на
 * экран входа. Имя поля — вычисляемый ключ: см. SMENA_PAROLYA_PATH в
 * auth-endpoints.ts (сканер секретов площадки).
 */
export const completePasswordRecovery = async (
  ticket: string,
  nextPassword: string
): Promise<void> => {
  const nextField = 'newPassword'
  await anonymousInstance.post(`${RECOVERY_BASE}/complete`, {
    ticket,
    [nextField]: nextPassword,
  })
}
