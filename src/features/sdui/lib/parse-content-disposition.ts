/**
 * Извлекает имя файла из заголовка Content-Disposition (SCRUM-268 §3.5).
 * Приоритет: RFC 5987 `filename*=UTF-8''<pct-encoded>` → `filename="..."` → ''.
 * Кривой percent-encoding в filename* — фолбэк на plain filename.
 */
export function parseContentDispositionFilename(
  header: string | undefined,
): string {
  if (!header) return ''

  const extMatch = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (extMatch) {
    const raw = extMatch[1].trim().replace(/^"|"$/g, '')
    try {
      return decodeURIComponent(raw)
    } catch {
      // кривой encoding — пробуем plain filename ниже
    }
  }

  const plainMatch = /filename="?([^";]+)"?/i.exec(header)
  return plainMatch ? plainMatch[1].trim() : ''
}
