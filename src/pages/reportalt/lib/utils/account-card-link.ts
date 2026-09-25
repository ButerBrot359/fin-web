import type { ReportAltRowDto } from '../../types/reportalt'

const GROUP_CODE_TO_FILTER: Record<string, string | undefined> = {
  Organizatsiya: 'organizatsiyaId',
  Podrazdelenie: 'podrazdelenieId',
  FKR: 'fkrId',
  Spetsifika: 'spetsifikaId',
  IstochnikFinansirovaniya: 'istochnikFinansirovaniyaId',
  KodPlatnykhUslug: 'kodPlatnykhUslugId',
}

const PARAM_TO_FILTER: Record<string, string> = {
  Organizatsiya: 'organizatsiyaId',
  Podrazdelenie: 'podrazdelenieId',
  Fkr: 'fkrId',
  Spetsifika: 'spetsifikaId',
  IstochnikFinansirovaniya: 'istochnikFinansirovaniyaId',
  KodPlatnykhUslug: 'kodPlatnykhUslugId',
}

export interface AccountCardLinkOptions {
  accountId: number
  accountCode?: string
  from?: string
  to?: string
  parameters?: Record<string, unknown>
}

export const buildAccountCardParams = (
  chain: ReportAltRowDto[],
  options: AccountCardLinkOptions
): URLSearchParams => {
  const params = new URLSearchParams({ accountId: String(options.accountId) })
  if (options.accountCode) params.set('accountCode', options.accountCode)
  if (options.from) params.set('from', options.from)
  if (options.to) params.set('to', options.to)
  for (const [code, key] of Object.entries(PARAM_TO_FILTER)) {
    const value = options.parameters?.[code]
    if (typeof value === 'number') params.set(key, String(value))
  }
  for (const row of chain) {
    const key = row.groupCode ? GROUP_CODE_TO_FILTER[row.groupCode] : undefined
    if (key && row.groupRefId != null) params.set(key, String(row.groupRefId))
  }
  return params
}
