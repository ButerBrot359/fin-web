// Маппинг кодов i18next (ru/kz) в канонические значения бэка (SCRUM-268).
// Сервер парсит lenient, но шлём канонику; неизвестный код → 'Ru'.
const LANG_MAP: Record<string, string> = { ru: 'Ru', kz: 'Kz' }

export function resolveViewLanguage(i18nLanguage: string): string {
  return LANG_MAP[i18nLanguage] ?? 'Ru'
}
