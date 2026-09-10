import type { ViewSettingsPatchEntry } from '../../api/view-settings-api'

/**
 * Экспорт/импорт пер-пользовательских настроек вида файлом (запрос владельца
 * 10.09): бухгалтер выгружает свою настройку формы, коллега импортирует её
 * себе. Формат — самоописывающий JSON; валидацию содержимого делает сервер
 * при PUT (белый список пропов, клампы), фронт проверяет только конверт.
 */

const VIEW_SETTINGS_KIND = 'webbuh.view-settings'

interface ViewSettingsFile {
  kind: typeof VIEW_SETTINGS_KIND
  screenKey: string
  /** Человеческое название формы — для имени файла и понятности содержимого. */
  title?: string
  exportedAt: string
  patch: ViewSettingsPatchEntry[]
}

export function downloadViewSettings(
  screenKey: string,
  patch: ViewSettingsPatchEntry[],
  title?: string
): void {
  const file: ViewSettingsFile = {
    kind: VIEW_SETTINGS_KIND,
    screenKey,
    title,
    exportedAt: new Date().toISOString(),
    patch,
  }
  // Имя файла — по названию страницы (решение владельца 11.09), технический
  // screenKey — только фолбэк без заголовка.
  const name = title?.trim()
    ? `Настройки формы — ${sanitize(title)}.json`
    : `Настройки формы — ${sanitize(screenKey)}.json`
  downloadJson(file, name)
}

/**
 * Разбирает файл настроек; бросает Error с человеческим текстом, если это не
 * файл настроек вида. Несовпадение screenKey НЕ ошибка: настройку с одной
 * формы осознанно переносят на ту же форму другого пользователя, а nodeId,
 * которых на экране нет, наложение молча пропустит.
 */
export function parseViewSettingsFile(raw: string): ViewSettingsPatchEntry[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Файл не является JSON')
  }
  const file = parsed as Partial<ViewSettingsFile>
  if (file.kind !== VIEW_SETTINGS_KIND || !Array.isArray(file.patch)) {
    throw new Error('Это не файл настроек вида')
  }
  return file.patch
}

export function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Убирает только недопустимое в именах файлов — кириллица и пробелы остаются. */
const sanitize = (value: string): string =>
  value
    .replace(/[\\/:*?"<>|\n\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
