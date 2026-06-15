/** Измерение-отбор: query-параметр фильтра + справочник значений + метка. */
export interface ReportFilterDimension {
  /** Имя query-параметра фильтра (organizatsiyaId, fkrId, …). */
  paramKey: string
  /** i18n-ключ метки поля. */
  labelKey: string
  /** Код справочника-источника значений (DICTIONARY typeCode). */
  dictTypeCode: string
}

/**
 * Шесть балансовых измерений регистра проводок — общий список отборов для ОСВ и
 * карточки счёта. Коды справочников и имена параметров подтверждены бэком
 * (AccountingRegisterSystemFieldRegistry + фильтры getMovements/ОСВ).
 */
export const REPORT_FILTER_DIMENSIONS = [
  {
    paramKey: 'organizatsiyaId',
    labelKey: 'osv.levelOrganization',
    dictTypeCode: 'Organizatsii',
  },
  {
    paramKey: 'podrazdelenieId',
    labelKey: 'osv.levelSubdivision',
    dictTypeCode: 'PodrazdeleniyaOrganizatsiy',
  },
  {
    paramKey: 'fkrId',
    labelKey: 'osv.levelFkr',
    dictTypeCode: 'FunktsionalnayaKlassifikatsiyaRaskhodov',
  },
  {
    paramKey: 'spetsifikaId',
    labelKey: 'osv.levelSpetsifika',
    dictTypeCode: 'EkonomicheskayaKlassifikatsiyaRaskhodov',
  },
  {
    paramKey: 'istochnikFinansirovaniyaId',
    labelKey: 'osv.levelFundingSource',
    dictTypeCode: 'VidyIstochnikovFinansirovaniya',
  },
  {
    paramKey: 'kodPlatnykhUslugId',
    labelKey: 'osv.levelKodPlatnykhUslug',
    dictTypeCode: 'KlassifikatorKodovPlatnykhUslug',
  },
] as const satisfies readonly ReportFilterDimension[]
