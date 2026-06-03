// The API layer (shared/api/api.ts) throws the raw response body on error,
// so the value caught here is usually the parsed error payload, not an Error.
interface ApiErrorShape {
  message?: string
  error?: string
  data?: { message?: string }
}

/**
 * Extract a human-readable error message from an API/network error so the
 * real backend message can be shown to the user instead of a generic text.
 * Returns undefined when no message can be derived (caller shows a fallback).
 */
export const getApiErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const apiError = error as ApiErrorShape
    return (
      apiError.data?.message ??
      apiError.message ??
      apiError.error ??
      undefined
    )
  }

  return undefined
}
