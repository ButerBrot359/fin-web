import type { ThemeTokens } from '@/entities/theme'

/**
 * Экспорт/импорт темы файлом (запрос владельца 10.09) — зеркало
 * `settings-transfer.ts` из SDUI: самоописывающий JSON, валидацию значений
 * делают сервер (структурные потолки) и CSS (мусорное значение отбрасывается).
 */

const THEME_KIND = 'webbuh.theme-settings'

interface ThemeSettingsFile {
  kind: typeof THEME_KIND
  exportedAt: string
  tokens: ThemeTokens
}

export function downloadThemeSettings(tokens: ThemeTokens): void {
  const file: ThemeSettingsFile = {
    kind: THEME_KIND,
    exportedAt: new Date().toISOString(),
    tokens,
  }
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'theme-settings.json'
  link.click()
  URL.revokeObjectURL(url)
}

export function parseThemeSettingsFile(raw: string): ThemeTokens {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Файл не является JSON')
  }
  const file = parsed as Record<string, unknown>
  const tokens = file.tokens
  if (
    file.kind !== THEME_KIND ||
    typeof tokens !== 'object' ||
    tokens === null
  ) {
    throw new Error('Это не файл настроек темы')
  }
  return tokens as ThemeTokens
}
