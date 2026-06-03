import type { ApiErrorResponse } from '@/shared/types/api.types'

// The API layer (shared/api/api.ts) throws the raw response body on error,
// so the value caught here is usually the parsed error payload, not an Error.
const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  typeof value === 'object' && value !== null

/**
 * Extracts a human-readable message from an API/network error so the real
 * backend message can be shown to the user instead of a generic text.
 * Prefers field-level validation messages (e.g. DOCUMENT_VALIDATION), then
 * falls back to the top-level message. Returns undefined when nothing can be
 * derived (caller shows a fallback).
 */
export const getApiErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string') return error

  if (!isApiErrorResponse(error)) return undefined

  const detailMessage = error.errors
    ?.map((detail) => detail.message)
    .filter((message): message is string => Boolean(message))
    .join('\n')

  return detailMessage || error.data?.message || error.message || error.error || undefined
}
