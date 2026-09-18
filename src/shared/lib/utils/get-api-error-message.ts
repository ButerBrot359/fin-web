import { ApiHttpError } from '@/shared/api/api-error'
import type { ApiErrorResponse } from '@/shared/types/api.types'

// The API layer (shared/api/api.ts) throws ApiHttpError with the parsed
// response body in `.body` (W-6); older call sites may still pass the raw
// payload, so both shapes are unwrapped here.
const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  typeof value === 'object' && value !== null

/**
 * Extracts a human-readable message from an API/network error so the real
 * backend message can be shown to the user instead of a generic text.
 * Prefers field-level validation messages (e.g. DOCUMENT_VALIDATION), then
 * falls back to the top-level message. Returns undefined when nothing can be
 * derived (caller shows a fallback) — the generic `ApiHttpError.message`
 * ("HTTP 500") is deliberately NOT used here.
 */
export const getApiErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof ApiHttpError) return getApiErrorMessage(error.body)

  if (typeof error === 'string') return error || undefined

  if (!isApiErrorResponse(error)) return undefined

  const detailMessage = error.errors
    ?.map((detail) => detail.message)
    .filter((message): message is string => Boolean(message))
    .join('\n')

  return (
    detailMessage ||
    error.data?.message ||
    error.message ||
    error.error ||
    undefined
  )
}
