// The API layer (shared/api/api.ts) throws the raw response body on error,
// so the value caught here is usually the parsed error payload, not an Error.
interface ValidationError {
  message?: unknown
}

interface ApiErrorShape {
  message?: unknown
  error?: unknown
  errors?: unknown
  data?: { message?: unknown; errors?: unknown }
}

const normalizeString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

// Field-level validation errors live in `errors[].message`; these carry the
// actual, user-actionable text and take priority over the generic top-level
// `message` (e.g. "Ошибки заполнения документа").
const fromValidationErrors = (value: unknown): string | undefined => {
  if (!Array.isArray(value)) return undefined
  const messages = value
    .map((item) => normalizeString((item as ValidationError)?.message))
    .filter(Boolean)
  return messages.length ? messages.join('\n') : undefined
}

/**
 * Extract a human-readable error message from an API/network error so the
 * real backend message can be shown to the user instead of a generic text.
 * Detailed field validation messages (errors[].message) win over the generic
 * top-level message. Always returns a string or undefined (never an object).
 */
export const getApiErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string') return normalizeString(error)

  if (error && typeof error === 'object') {
    const apiError = error as ApiErrorShape
    return (
      fromValidationErrors(apiError.errors) ??
      fromValidationErrors(apiError.data?.errors) ??
      normalizeString(apiError.data?.message) ??
      normalizeString(apiError.message) ??
      normalizeString(apiError.error)
    )
  }

  return undefined
}
