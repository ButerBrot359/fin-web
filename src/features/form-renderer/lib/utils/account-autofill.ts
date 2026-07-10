import type { DocumentAttribute } from '@/entities/document-type'
import { resolveAttributeDomain } from '@/shared/lib/consts/data-types'

/**
 * Конфиг автоподстановки «Счёт учёта» в строке ТЧ по выбранному элементу.
 * Триггер — Номенклатура (ТМЗ/Услуги) или ВидВНА (ОС/НМА). Значения — коды
 * колонок этой ТЧ; вся логика подбора счёта — на бэке (GET-эндпоинт).
 */
export interface AccountAutofillConfig {
  trigger: 'nomenklatura' | 'vidVna'
  triggerCol: string
  schetUchetaCol: string
  /** Только для ВидВНА (ОС/НМА). */
  schetAmortizatsiiCol?: string
  spiCol?: string
  nachislyatCol?: string
}

const eqOrEnds = (code: string, root: string): boolean => {
  const a = code.toLowerCase()
  const b = root.toLowerCase()
  return a === b || a.endsWith(b)
}

const isAmort = (code: string): boolean => code.toLowerCase().includes('amortiz')

const findCol = (
  columns: DocumentAttribute[],
  codeRoots: string[],
  names1C: string[]
): string | undefined =>
  columns.find(
    (c) =>
      codeRoots.some((r) => eqOrEnds(c.code, r)) || names1C.includes(c.code1C)
  )?.code

const accountColumns = (columns: DocumentAttribute[]): DocumentAttribute[] =>
  columns.filter(
    (c) =>
      c.dataType === 'ACCOUNT_PLAN' ||
      resolveAttributeDomain(c)?.domain === 'ACCOUNT_PLAN'
  )

/**
 * Определяет триггер и целевые колонки. Возвращает null, если в ТЧ нет колонки
 * «Счёт учёта» или нет триггера (Номенклатура/ВидВНА) — тогда автоподстановки нет.
 */
export const resolveAccountAutofill = (
  columns: DocumentAttribute[]
): AccountAutofillConfig | null => {
  const accounts = accountColumns(columns)
  // «Счёт учёта» = ссылочный счёт, не являющийся счётом амортизации.
  const schetUchetaCol = (
    accounts.find((c) => !isAmort(c.code) && eqOrEnds(c.code, 'SchetUcheta')) ??
    accounts.find((c) => !isAmort(c.code)) ??
    accounts[0]
  )?.code
  if (!schetUchetaCol) return null

  const vidVnaCol = findCol(
    columns,
    ['VidVna', 'VidVNA'],
    ['ВидВНА', 'Вид ВНА', 'Вид актива']
  )
  if (vidVnaCol) {
    return {
      trigger: 'vidVna',
      triggerCol: vidVnaCol,
      schetUchetaCol,
      schetAmortizatsiiCol: accounts.find((c) => isAmort(c.code))?.code,
      spiCol: findCol(
        columns,
        ['SrokPoleznogoIspolzovaniya'],
        ['Срок полезного использования', 'СПИ']
      ),
      nachislyatCol: findCol(
        columns,
        ['NachislyatAmortizatsiyu'],
        ['Начислять амортизацию']
      ),
    }
  }

  const nomenklaturaCol = findCol(columns, ['Nomenklatura'], ['Номенклатура'])
  if (nomenklaturaCol) {
    return {
      trigger: 'nomenklatura',
      triggerCol: nomenklaturaCol,
      schetUchetaCol,
    }
  }

  return null
}

/** URL GET-эндпоинта подбора счёта по id выбранного элемента. */
export const accountAutofillUrl = (
  cfg: AccountAutofillConfig,
  id: number | string
): string =>
  cfg.trigger === 'vidVna'
    ? `/api/vneoborotnye-aktivy/vid-vna/${id}/uchet-params`
    : `/api/nomenklatura/${id}/schet-ucheta`

/** Значение ссылки на счёт для ячейки-пикера: id (для сохранения) + код (для показа). */
export const buildAccountRef = (
  id: number | string,
  code: unknown
): Record<string, unknown> => ({
  id,
  code: typeof code === 'string' ? code : String(code ?? ''),
  displayName: typeof code === 'string' ? code : String(code ?? ''),
})
