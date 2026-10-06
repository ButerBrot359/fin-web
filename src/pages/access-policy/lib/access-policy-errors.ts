import i18n from 'i18next'

import { isApiConflictError, isApiHttpError } from '@/shared/api/api-error'

/**
 * Разбор ошибок `POST /switch` и `/rollback` по таблице 11.4 спеки SCRUM-400.
 * Решения здесь только классифицируются; что делать (перечитать overview,
 * показать problems) — решает форма.
 */
export interface AccessPolicyError {
  kind:
    | 'bad-request' // 400 — message называет поле, показать как есть
    | 'forbidden' // 403 — нет допуска
    | 'policy-changed' // 409 ACCESS_POLICY_CHANGED — перечитать состояние
    | 'policy-conflict' // 409 ACCESS_POLICY_CONFLICT / MODE_TRANSITION_REJECTED
    | 'preflight-failed' // 422 — режим не изменён, причины в problems
    | 'unknown'
  message: string
  problems: string[]
}

export function parseAccessPolicyError(error: unknown): AccessPolicyError {
  if (isApiConflictError(error)) {
    return {
      kind:
        error.code === 'ACCESS_POLICY_CHANGED'
          ? 'policy-changed'
          : 'policy-conflict',
      message: error.message || i18n.t('accessPolicy.errors.conflict'),
      problems: [],
    }
  }
  if (isApiHttpError(error)) {
    const body = (
      error.body && typeof error.body === 'object' ? error.body : {}
    ) as Record<string, unknown>
    const message =
      (typeof body.message === 'string' && body.message) || error.message
    if (error.status === 422) {
      const data = (
        body.data && typeof body.data === 'object' ? body.data : {}
      ) as Record<string, unknown>
      const problems = Array.isArray(data.problems)
        ? data.problems.filter((p): p is string => typeof p === 'string')
        : []
      return { kind: 'preflight-failed', message, problems }
    }
    if (error.status === 403)
      return { kind: 'forbidden', message, problems: [] }
    if (error.status === 400) {
      return { kind: 'bad-request', message, problems: [] }
    }
  }
  return {
    kind: 'unknown',
    message:
      error instanceof Error && error.message
        ? error.message
        : i18n.t('accessPolicy.errors.unknown'),
    problems: [],
  }
}
