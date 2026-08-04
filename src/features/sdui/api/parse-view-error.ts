// Тело ошибок SDUI несёт код в поле `error` (единообразно с 409), кроме
// унаследованного 404, где `code` (§2 бэк-спеки SCRUM-290). Нормализуем оба.
export function parseViewError(data: unknown): {
  message?: string
  code?: string
  kind?: string
} {
  if (!data || typeof data !== 'object') return {}
  const b = data as Record<string, unknown>
  const code =
    (typeof b.error === 'string' && b.error) ||
    (typeof b.code === 'string' && b.code) ||
    undefined
  const kind = typeof b.kind === 'string' ? b.kind : undefined
  const message = typeof b.message === 'string' ? b.message : undefined
  const out: { message?: string; code?: string; kind?: string } = {}
  if (code) out.code = code
  if (kind) out.kind = kind
  if (message) out.message = message
  return out
}
