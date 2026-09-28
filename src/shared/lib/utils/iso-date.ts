import { format, isValid, parse, parseISO } from 'date-fns'

export const ISO_DATE_FORMAT = 'yyyy-MM-dd'
export const ISO_DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss"

export const DISPLAY_DATE_FORMAT = 'dd.MM.yyyy'
export const DISPLAY_DATETIME_FORMAT = 'dd.MM.yyyy HH:mm'
export const DISPLAY_DATETIME_SECONDS_FORMAT = 'dd.MM.yyyy HH:mm:ss'
export const DISPLAY_TIME_FORMAT = 'HH:mm'

/**
 * Век для двузначного года (SCRUM-279 D6). См. `expandTwoDigitYear`.
 */
const TWO_DIGIT_YEAR_CENTURY = 2000

/**
 * Достройка века для двузначного года — семантика 1С (SCRUM-279 D6).
 *
 * В 1С ввод «01.01.26» даёт 01.01.2026: платформа достраивает век сама (снято с
 * эталонной базы 30.07 на реквизите «Период действия»). MUI-пикер так не умеет:
 * год — четырёхсегментное поле, две введённые цифры остаются годом 0026, и
 * аналитик видит «01.01.0002»/«01.01.0026» вместо даты.
 *
 * Правило простое и предсказуемое: год 0…99 → 2000+год. Оно намеренно НЕ
 * скользящее (нет ветки «30…99 → 19xx» как в Excel): такого поведения в 1С мы не
 * наблюдали, а выдумывать правило под свою догадку в проекте, где транслитерация
 * и семантика берутся только из эталона, — прямой путь к тихому расхождению.
 *
 * ОТКРЫТЫЙ ВОПРОС аналитику: «Дата рождения» — тоже дата, и «65» по этому
 * правилу станет 2065, а не 1965. Сегодня она превращается в 0065, то есть
 * сломана в любом случае; но если аналитик подтвердит, что в 1С двузначный год в
 * датах рождения уходит в 19xx, правка — одна строка ровно здесь, в единственном
 * месте, и она покрыта тестами.
 */
function expandTwoDigitYear(value: Date): Date {
  const year = value.getFullYear()
  if (year < 0 || year >= 100) return value
  const expanded = new Date(value)
  expanded.setFullYear(TWO_DIGIT_YEAR_CENTURY + year)
  return expanded
}

export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return isValid(value) ? value : null
  if (typeof value !== 'string' || value.trim() === '') return null
  const parsed = parseISO(value.trim())
  return isValid(parsed) ? parsed : null
}

export function toIsoDate(value: unknown): string | null {
  const date = toDate(value)
  return date ? format(expandTwoDigitYear(date), ISO_DATE_FORMAT) : null
}

export function toIsoDateTime(value: unknown): string | null {
  const date = toDate(value)
  return date ? format(expandTwoDigitYear(date), ISO_DATETIME_FORMAT) : null
}

export function parseDisplayDate(text: string): Date | null {
  const match = /^\d{1,2}\.\d{1,2}\.\d{4}/.exec(text.trim())
  if (!match) return null
  const parsed = parse(match[0], DISPLAY_DATE_FORMAT, new Date())
  return isValid(parsed) ? parsed : null
}

export function displayPatternForFormat(columnFormat?: string | null): string {
  return columnFormat?.includes('HH')
    ? DISPLAY_DATETIME_SECONDS_FORMAT
    : DISPLAY_DATE_FORMAT
}
