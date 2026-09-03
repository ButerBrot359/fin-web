import type { ValidationErrorDetail } from '../types/view'

function parseValidationErrors(
  raw: unknown
): ValidationErrorDetail[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out: ValidationErrorDetail[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    const attributeCode =
      typeof e.attributeCode === 'string' && e.attributeCode !== ''
        ? e.attributeCode
        : null
    const detail: ValidationErrorDetail = { attributeCode }
    if (typeof e.errorCode === 'string') detail.errorCode = e.errorCode
    if (typeof e.message === 'string') detail.message = e.message
    out.push(detail)
  }
  return out
}

// Тело ошибок SDUI несёт код только в поле `error` (единообразно с 409):
// все обработчики /api/view кладут `error`, ключа `code` бэк не эмитит —
// ADR-0042 §0.1 (SCRUM-366), мёртвый фолбэк удалён.
export function parseViewError(data: unknown): {
  message?: string
  code?: string
  kind?: string
  errors?: ValidationErrorDetail[]
} {
  if (!data || typeof data !== 'object') return {}
  const b = data as Record<string, unknown>
  const code = (typeof b.error === 'string' && b.error) || undefined
  const kind = typeof b.kind === 'string' ? b.kind : undefined
  const message = typeof b.message === 'string' ? b.message : undefined
  const errors = parseValidationErrors(b.errors)
  const out: {
    message?: string
    code?: string
    kind?: string
    errors?: ValidationErrorDetail[]
  } = {}
  if (code) out.code = code
  if (kind) out.kind = kind
  if (message) out.message = message
  if (errors) out.errors = errors
  return out
}
