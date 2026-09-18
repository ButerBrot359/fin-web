import type { ReportAltRowDto } from '../../types/reportalt'

const GROUP_CODE_TO_FILTER: Record<string, string | undefined> = {
  Organizatsiya: 'organizatsiyaId',
  Podrazdelenie: 'podrazdelenieId',
  FKR: 'fkrId',
  Spetsifika: 'spetsifikaId',
  IstochnikFinansirovaniya: 'istochnikFinansirovaniyaId',
  KodPlatnykhUslug: 'kodPlatnykhUslugId',
}

export interface AccountCardLinkOptions {
  accountId: number
  accountCode?: string
  from?: string
  to?: string
}

export const buildAccountCardParams = (
  chain: ReportAltRowDto[],
  options: AccountCardLinkOptions
): URLSearchParams => {
  const params = new URLSearchParams({ accountId: String(options.accountId) })
  if (options.accountCode) params.set('accountCode', options.accountCode)
  if (options.from) params.set('from', options.from)
  if (options.to) params.set('to', options.to)
  for (const row of chain) {
    const key = row.groupCode ? GROUP_CODE_TO_FILTER[row.groupCode] : undefined
    if (key && row.groupRefId != null) params.set(key, String(row.groupRefId))
  }
  return params
}
