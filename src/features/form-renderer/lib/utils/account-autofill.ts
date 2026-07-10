import type { DocumentAttribute } from '@/entities/document-type'
import { resolveAttributeDomain } from '@/shared/lib/consts/data-types'

/** Тип триггера автоподстановки — определяет GET-эндпоинт. */
export type AutofillTriggerKind = 'asset' | 'vidVna' | 'nomenklatura'

export interface AutofillTrigger {
  kind: AutofillTriggerKind
  /** Код колонки-триггера (Основное средство/НМА, ВидВНА, Номенклатура). */
  triggerCol: string
}

/** Колонки-цели ТЧ, куда раскладывается ответ эндпоинта (какие есть). */
export interface AutofillTargets {
  schetUchetaCol?: string
  vidVnaCol?: string
  schetAmortizatsiiCol?: string
  molCol?: string
  spiCol?: string
  nachislyatCol?: string
  pervonachalnayaStoimostCol?: string
  tekushchayaStoimostCol?: string
  /** «Дата ввода» строки ОС/НМА — фронт ставит из даты документа (шапка). */
  dataVvodaCol?: string
}

export interface AccountAutofillConfig {
  triggers: AutofillTrigger[]
  targets: AutofillTargets
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
 * Определяет триггеры (Основное средство/НМА, ВидВНА, Номенклатура) и целевые
 * колонки ТЧ. Возвращает null, если нет колонки «Счёт учёта» или ни одного
 * триггера. Вся логика подбора счёта — на бэке (GET по id элемента).
 */
export const resolveAccountAutofill = (
  columns: DocumentAttribute[]
): AccountAutofillConfig | null => {
  const accounts = accountColumns(columns)
  const schetUchetaCol = (
    accounts.find((c) => !isAmort(c.code) && eqOrEnds(c.code, 'SchetUcheta')) ??
    accounts.find((c) => !isAmort(c.code)) ??
    accounts[0]
  )?.code
  if (!schetUchetaCol) return null

  const targets: AutofillTargets = {
    schetUchetaCol,
    schetAmortizatsiiCol: accounts.find((c) => isAmort(c.code))?.code,
    vidVnaCol: findCol(
      columns,
      ['VidVna', 'VidVNA'],
      ['ВидВНА', 'Вид ВНА', 'Вид актива']
    ),
    molCol: findCol(
      columns,
      ['MOL', 'MaterialnoOtvetstvennoeLitso'],
      ['МОЛ', 'Материально ответственное лицо', 'Материально-ответственное лицо']
    ),
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
    pervonachalnayaStoimostCol: findCol(
      columns,
      ['PervonachalnayaStoimost'],
      ['Первоначальная стоимость']
    ),
    tekushchayaStoimostCol: findCol(
      columns,
      ['TekushchayaStoimost'],
      ['Текущая стоимость']
    ),
    dataVvodaCol: findCol(
      columns,
      ['DataVvoda', 'DataPrinyatiyaKUchetu', 'DataPrinyatiya'],
      ['Дата ввода', 'Дата принятия к учету', 'Дата принятия к учёту']
    ),
  }

  const triggers: AutofillTrigger[] = []

  const assetCol = findCol(
    columns,
    ['OsnovnoeSredstvo', 'NematerialnyyAktiv', 'VneoborotnyyAktiv'],
    ['Основное средство', 'Нематериальный актив', 'Внеоборотный актив', 'Актив']
  )
  if (assetCol) triggers.push({ kind: 'asset', triggerCol: assetCol })

  if (targets.vidVnaCol) {
    triggers.push({ kind: 'vidVna', triggerCol: targets.vidVnaCol })
  }

  const nomenklaturaCol = findCol(columns, ['Nomenklatura'], ['Номенклатура'])
  if (nomenklaturaCol) {
    triggers.push({ kind: 'nomenklatura', triggerCol: nomenklaturaCol })
  }

  return triggers.length > 0 ? { triggers, targets } : null
}

/** URL GET-эндпоинта подбора по типу триггера и id выбранного элемента. */
export const accountAutofillUrl = (
  kind: AutofillTriggerKind,
  id: number | string
): string => {
  switch (kind) {
    case 'asset':
      return `/api/vneoborotnye-aktivy/asset/${id}/uchet-params`
    case 'vidVna':
      return `/api/vneoborotnye-aktivy/vid-vna/${id}/uchet-params`
    case 'nomenklatura':
      return `/api/nomenklatura/${id}/schet-ucheta`
  }
}

/** Значение ссылки на счёт/вид для ячейки-пикера: id (сохраняем) + код (показываем). */
export const buildAccountRef = (
  id: number | string,
  code: unknown
): Record<string, unknown> => ({
  id,
  code: typeof code === 'string' ? code : String(code ?? ''),
  displayName: typeof code === 'string' ? code : String(code ?? ''),
})
