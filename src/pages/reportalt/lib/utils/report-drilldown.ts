import type { ReportAltRowDto } from '../../types/reportalt'

export type DrilldownTargetKind =
  | 'accountCard'
  | 'subkontoCard'
  | 'postingsReport'
  | 'osvPoSchetu'
  | 'analizScheta'
  | 'turnoverByDays'
  | 'turnoverByMonths'

export interface DrilldownTarget {
  kind: DrilldownTargetKind
  reportCode: string
  params: URLSearchParams
}

export interface DrilldownOptions {
  reportCode: string
  chain: ReportAltRowDto[]
  accountRow?: ReportAltRowDto
  valueRow?: ReportAltRowDto
  from?: string
  to?: string
}

const CORR_ACCOUNT_GROUP_CODE = 'KorrSchet'

export const DRILLDOWN_URL_KEY = 'rr'

const ETALON_TARGETS: Record<string, DrilldownTargetKind[] | undefined> = {
  OborotnoSaldovayaVedomost: [
    'osvPoSchetu',
    'accountCard',
    'analizScheta',
    'turnoverByMonths',
    'turnoverByDays',
  ],
  OSVPoSchetu: ['accountCard'],
  OborotyScheta: ['postingsReport'],
}

const SUBKONTO_GROUP_CODES = ['Subkonto1', 'Subkonto2', 'Subkonto3']

const DIMENSION_TO_PARAM: Record<string, string | undefined> = {
  Organizatsiya: 'Organizatsiya',
  Podrazdelenie: 'Podrazdelenie',
  FKR: 'Fkr',
  Spetsifika: 'Spetsifika',
  IstochnikFinansirovaniya: 'IstochnikFinansirovaniya',
  KodPlatnykhUslug: 'KodPlatnykhUslug',
}

const SUBKONTO_CARD_DIMENSIONS = [
  'Organizatsiya',
  'Podrazdelenie',
  'Fkr',
  'Spetsifika',
  'IstochnikFinansirovaniya',
  'KodPlatnykhUslug',
]

export const isSubkontoRow = (row: ReportAltRowDto): boolean =>
  row.groupCode != null &&
  SUBKONTO_GROUP_CODES.includes(row.groupCode) &&
  row.rowRef != null &&
  row.rowRef.domain !== 'ACCOUNT_PLAN'

const withPeriod = (
  params: URLSearchParams,
  from?: string,
  to?: string
): URLSearchParams => {
  params.set(DRILLDOWN_URL_KEY, '1')
  if (from && to) params.set('Period', JSON.stringify({ from, to }))
  return params
}

const withDimensions = (
  params: URLSearchParams,
  chain: ReportAltRowDto[],
  allowed: string[]
): URLSearchParams => {
  for (const row of chain) {
    const code = row.groupCode ? DIMENSION_TO_PARAM[row.groupCode] : undefined
    if (!code || !allowed.includes(code)) continue
    if (row.groupRefId != null) params.set(code, String(row.groupRefId))
  }
  return params
}

const isCorrAccountRow = (row?: ReportAltRowDto): boolean =>
  row?.groupCode === CORR_ACCOUNT_GROUP_CODE

export const resolveDrilldownKinds = ({
  reportCode,
  chain,
  accountRow,
  valueRow,
}: DrilldownOptions): DrilldownTargetKind[] => {
  const fixed = ETALON_TARGETS[reportCode]
  if (fixed) {
    return accountRow ? fixed : []
  }
  if (reportCode === 'AnalizScheta') {
    if (isCorrAccountRow(valueRow) || chain.some(isCorrAccountRow)) {
      return ['postingsReport']
    }
    return accountRow ? ['accountCard'] : []
  }
  if (reportCode === 'AnalizSubkonto') {
    return accountRow ? ['accountCard'] : ['subkontoCard']
  }
  return []
}

export const buildDrilldownTarget = (
  kind: DrilldownTargetKind,
  { chain, accountRow, valueRow, from, to }: DrilldownOptions
): DrilldownTarget | null => {
  if (kind === 'accountCard') {
    return null
  }
  if (kind === 'subkontoCard') {
    if (valueRow?.rowRef == null || !isSubkontoRow(valueRow)) {
      return null
    }
    const params = withPeriod(new URLSearchParams(), from, to)
    params.set('ZnachenieSubkonto', JSON.stringify([valueRow.rowRef.id]))
    return {
      kind,
      reportCode: 'KartochkaSubkonto',
      params: withDimensions(params, chain, SUBKONTO_CARD_DIMENSIONS),
    }
  }
  if (accountRow?.rowRef == null) {
    return null
  }
  const accountId = String(accountRow.rowRef.id)
  const params = withPeriod(new URLSearchParams(), from, to)
  params.set('Schet', accountId)
  if (kind === 'turnoverByDays' || kind === 'turnoverByMonths') {
    params.set('Periodichnost', kind === 'turnoverByDays' ? '6' : '9')
    return {
      kind,
      reportCode: 'OborotyScheta',
      params: withDimensions(params, chain, ['Organizatsiya']),
    }
  }
  const reportCode =
    kind === 'osvPoSchetu'
      ? 'OSVPoSchetu'
      : kind === 'analizScheta'
        ? 'AnalizScheta'
        : 'OtchetPoProvodkam'
  return {
    kind,
    reportCode,
    params: withDimensions(params, chain, ['Organizatsiya']),
  }
}

export const buildDrilldownTargets = (
  options: DrilldownOptions
): DrilldownTarget[] =>
  resolveDrilldownKinds(options)
    .map((kind) => buildDrilldownTarget(kind, options))
    .filter((target): target is DrilldownTarget => target != null)
