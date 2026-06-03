import type { ApiErrorResponse } from '@/shared/types/api.types'

const isApiErrorResponse = (value: unknown): value is ApiErrorResponse =>
  typeof value === 'object' && value !== null

/**
 * Extracts a human-readable message from a server error body.
 * Prefers field-level validation messages (e.g. DOCUMENT_VALIDATION),
 * then falls back to the top-level message.
 */
export const getApiErrorMessage = (error: unknown): string | undefined => {
  if (!isApiErrorResponse(error)) return undefined

  const detailMessage = error.errors
    ?.map((detail) => detail.message)
    .filter((message): message is string => Boolean(message))
    .join('\n')

  return detailMessage || error.message || undefined
}
