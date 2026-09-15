import type { ReportAltRowDto } from '../../types/reportalt'

export type DrilldownTargetKind =
  | 'subkontoCard'
  | 'postingsReport'
  | 'turnoverByDays'
  | 'turnoverByMonths'

export interface DrilldownTarget {
  kind: DrilldownTargetKind
  reportCode: string
  params: URLSearchParams
}

export interface DrilldownOptions {
  chain: ReportAltRowDto[]
  accountRow?: ReportAltRowDto
  valueRow?: ReportAltRowDto
  from?: string
  to?: string
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

export const buildDrilldownTargets = ({
  chain,
  accountRow,
  valueRow,
  from,
  to,
}: DrilldownOptions): DrilldownTarget[] => {
  const targets: DrilldownTarget[] = []

  if (valueRow?.rowRef != null && isSubkontoRow(valueRow)) {
    const params = withPeriod(new URLSearchParams(), from, to)
    params.set('ZnachenieSubkonto', JSON.stringify([valueRow.rowRef.id]))
    targets.push({
      kind: 'subkontoCard',
      reportCode: 'KartochkaSubkonto',
      params: withDimensions(params, chain, SUBKONTO_CARD_DIMENSIONS),
    })
  }

  if (accountRow?.rowRef == null) return targets
  const accountId = String(accountRow.rowRef.id)

  const postings = withPeriod(new URLSearchParams(), from, to)
  postings.set('Schet', accountId)
  targets.push({
    kind: 'postingsReport',
    reportCode: 'OtchetPoProvodkam',
    params: withDimensions(postings, chain, ['Organizatsiya']),
  })

  const turnovers: [DrilldownTargetKind, string][] = [
    ['turnoverByDays', '6'],
    ['turnoverByMonths', '9'],
  ]
  for (const [kind, periodichnost] of turnovers) {
    const params = withPeriod(new URLSearchParams(), from, to)
    params.set('Schet', accountId)
    params.set('Periodichnost', periodichnost)
    targets.push({
      kind,
      reportCode: 'OborotyScheta',
      params: withDimensions(params, chain, ['Organizatsiya']),
    })
  }

  return targets
}
