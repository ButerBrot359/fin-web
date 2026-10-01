import type { ReportSpreadsheetDto } from '@/pages/reports/report-list/types/report'

/**
 * Очистка страниц бланка.
 *
 * <p>В 1С «Очистить текущую страницу» и «Очистить приложение 200.05» стирают данные областей
 * выбранных страниц табличного документа, не трогая остальные. У нас значение области стирается
 * пустой строкой ручного ввода: она приоритетнее расчёта и переживает «Обновить», как ручная
 * правка табличного документа в эталоне.
 */
export const pustyeOblastiStranits = (
  spreadsheet: ReportSpreadsheetDto | undefined,
  nuzhna: (title: string, indeks: number) => boolean
): Record<string, string> => {
  const pustye: Record<string, string> = {}
  spreadsheet?.sheets.forEach((sheet, indeks) => {
    if (!nuzhna(sheet.title, indeks)) return
    for (const cell of sheet.cells) {
      if (cell.field != null) pustye[cell.field] = ''
    }
  })
  return pustye
}

/** Страница приложения: в бланке её заголовок начинается с номера приложения — «200.05 стр.1». */
export const stranitsaPrilozheniya = (title: string, nomer: string): boolean =>
  title.startsWith(`${nomer} `)
