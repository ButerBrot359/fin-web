// Тело ошибок SDUI несёт код только в поле `error` — включая унаследованный
// 404 (SCRUM-362 B-8, гейт бэка «все тела ошибок несут error»).
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
