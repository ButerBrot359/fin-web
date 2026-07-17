import { format, isValid, parseISO } from '@/shared/lib/utils/date'

import type { ReportAltParameterDto } from '../../types/reportalt'

/**
 * Значение одного параметра формы. Тип зависит от `dataType`:
 * DATE → string (ISO); PERIOD → {from,to}; ACCOUNT_LIST/REF_LIST → number[];
 * *_REF → number | '' (черновик); BOOLEAN → boolean; NUMBER → number | '';
 * STRING → string.
 */
export type ReportAltParamValue =
  | string
  | number
  | boolean
  | number[]
  | PeriodValue
  | null
  | undefined

/** PERIOD-параметр хранит пару дат. */
export interface PeriodValue {
  from: string
  to: string
}

/** Значения формы параметров: ключ = `param.code`. */
export type ParamValues = Record<string, ReportAltParamValue>

/**
 * Код параметра «Язык формы» (STRING+allowedValues [Ru,Kz]) — единый по всем
 * отчётам ReportAlt (МО, ГлавнаяКнига, ВедомостьСписанияГСМ). Рендерится НЕ в
 * строке параметров, а отдельным контролом «Язык формы» в панели настроек
 * справа — как «Язык печатной формы» в 1С и вкладка «Основные» легаси-контура.
 */
export const LANG_PARAM_CODE = 'YazykFormy'

export const isPeriod = (p: ReportAltParameterDto) => p.dataType === 'PERIOD'

/**
 * Нормализация даты для тела `/run`: бэкенд ждёт локальную дату `yyyy-MM-dd`
 * (границы дня расставляет сам), а инпуты отдают ISO с `Z`.
 */
const toLocalDate = (raw: string): string => {
  if (!raw) return raw
  const d = parseISO(raw)
  if (!isValid(d)) return raw
  return format(d, 'yyyy-MM-dd')
}

/** Нормализует DATE-строки и PERIOD-объекты `{from,to}` в теле запроса. */
export const normalizeBodyDates = (
  parameters: Record<string, unknown>,
  metaParams: ReportAltParameterDto[]
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...parameters }
  for (const p of metaParams) {
    if (p.dataType === 'DATE') {
      const v = out[p.code]
      if (typeof v === 'string' && v) out[p.code] = toLocalDate(v)
      continue
    }
    if (!isPeriod(p)) continue
    const v = out[p.code] as PeriodValue | undefined
    if (v && typeof v === 'object') {
      out[p.code] = { ...v, from: toLocalDate(v.from), to: toLocalDate(v.to) }
    }
  }
  return out
}

/**
 * Сериализация значений параметров в query-строку URL (одно поле на параметр,
 * массивы/объекты — JSON) — applied-параметры переживают перезагрузку.
 */
export const serializeParams = (
  values: ParamValues
): Record<string, string> => {
  const out: Record<string, string> = {}
  for (const [code, v] of Object.entries(values)) {
    if (v == null || v === '') continue
    out[code] = typeof v === 'object' ? JSON.stringify(v) : String(v)
  }
  return out
}

/** Десериализация одного значения параметра из URL по типу параметра. */
export const deserializeParam = (
  raw: string,
  param: ReportAltParameterDto
): ReportAltParamValue => {
  switch (param.dataType) {
    case 'PERIOD':
    case 'ACCOUNT_LIST':
    case 'REF_LIST':
      try {
        return JSON.parse(raw) as ReportAltParamValue
      } catch {
        return undefined
      }
    case 'BOOLEAN':
      return raw === 'true'
    case 'NUMBER':
    case 'ACCOUNT_REF':
    case 'DICTIONARY_REF':
    case 'ENUM_REF':
      return raw === '' ? '' : Number(raw)
    default:
      return raw
  }
}

/** Дефолтное значение параметра (meta.defaultValue или пустое по типу). */
export const defaultParamValue = (
  param: ReportAltParameterDto
): ReportAltParamValue => {
  if (param.defaultValue != null) {
    return param.defaultValue as ReportAltParamValue
  }
  switch (param.dataType) {
    case 'ACCOUNT_LIST':
    case 'REF_LIST':
      return []
    case 'BOOLEAN':
      return false
    case 'PERIOD':
      return { from: '', to: '' }
    default:
      // «Язык формы» (YazykFormy) должен всегда показывать выбранный язык
      // (в 1С по умолчанию «Русский»), а не стартовать пустым и молча
      // проваливаться в глобальный Accept-Language — глобальный переключатель
      // языка приложения пока не переключает контент отчёта. Дефолт — первое
      // значение из allowedValues (Ru).
      if (
        param.code === LANG_PARAM_CODE &&
        param.allowedValues &&
        param.allowedValues.length > 0
      ) {
        return param.allowedValues[0].value
      }
      return ''
  }
}

/** Заполнен ли обязательный параметр. */
export const isFilled = (
  param: ReportAltParameterDto,
  v: ReportAltParamValue
): boolean => {
  if (isPeriod(param)) {
    const p = v as PeriodValue | undefined
    return !!p && typeof p === 'object' && !!p.from && !!p.to
  }
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'boolean') return true
  return v != null && v !== ''
}
