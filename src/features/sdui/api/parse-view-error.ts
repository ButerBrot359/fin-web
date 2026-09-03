// Тело ошибок SDUI несёт код только в поле `error` (единообразно с 409):
// все обработчики /api/view кладут `error`, ключа `code` бэк не эмитит —
// ADR-0042 §0.1 (SCRUM-366), мёртвый фолбэк удалён.
export function parseViewError(data: unknown): {
  message?: string
  code?: string
  kind?: string
} {
  if (!data || typeof data !== 'object') return {}
  const b = data as Record<string, unknown>
  const code = (typeof b.error === 'string' && b.error) || undefined
  const kind = typeof b.kind === 'string' ? b.kind : undefined
  const message = typeof b.message === 'string' ? b.message : undefined
  const out: { message?: string; code?: string; kind?: string } = {}
  if (code) out.code = code
  if (kind) out.kind = kind
  if (message) out.message = message
  return out
}
