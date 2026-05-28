import type {
  AccountPlanEntryDto,
  AccountPlanSubkontoKindDto,
  CharacteristicValueKind,
  CompositeTarget,
} from '@/entities/account-plan'

export interface ValueKindDescriptor {
  /** i18n-ключ заголовка бейджа. */
  labelKey: `accountPlan.valueKind.${Lowercase<CharacteristicValueKind>}`
  /** Tailwind-классы бейджа (фон + текст). */
  badgeClass: string
  /** Краткое описание значения (код типа справочника/документа и т.п.). */
  summary: string
  /** Для COMPOSITE — список целей, иначе null. */
  compositeTargets: CompositeTarget[] | null
}

const PALETTE: Record<CharacteristicValueKind, string> = {
  DICTIONARY: 'bg-blue-100 text-blue-700',
  DOCUMENT: 'bg-emerald-100 text-emerald-700',
  ENUMS: 'bg-orange-100 text-orange-700',
  PRIMITIVE: 'bg-gray-100 text-gray-700',
  COMPOSITE: 'bg-purple-100 text-purple-700',
}

const LABEL_KEY: Record<CharacteristicValueKind, ValueKindDescriptor['labelKey']> = {
  DICTIONARY: 'accountPlan.valueKind.dictionary',
  DOCUMENT: 'accountPlan.valueKind.document',
  ENUMS: 'accountPlan.valueKind.enums',
  PRIMITIVE: 'accountPlan.valueKind.primitive',
  COMPOSITE: 'accountPlan.valueKind.composite',
}

/** Описание ветки valueKind для рендера строки таблицы субконто. */
export const describeValueKind = (
  row: AccountPlanSubkontoKindDto
): ValueKindDescriptor => {
  const badgeClass = PALETTE[row.valueKind]
  const labelKey = LABEL_KEY[row.valueKind]

  switch (row.valueKind) {
    case 'DICTIONARY':
      return {
        labelKey,
        badgeClass,
        summary: row.valueDictionaryTypeCode ?? '',
        compositeTargets: null,
      }
    case 'DOCUMENT':
      return {
        labelKey,
        badgeClass,
        summary: row.valueDocumentTypeCode ?? '',
        compositeTargets: null,
      }
    case 'ENUMS':
      return {
        labelKey,
        badgeClass,
        summary: row.valueEnumsTypeCode ?? '',
        compositeTargets: null,
      }
    case 'PRIMITIVE':
      return {
        labelKey,
        badgeClass,
        summary: row.valuePrimitiveType ?? '',
        compositeTargets: null,
      }
    case 'COMPOSITE': {
      const targets = row.compositeTargets ?? []
      return {
        labelKey,
        badgeClass,
        summary: targets.map((t) => t.targetNameRu).join(', '),
        compositeTargets: targets,
      }
    }
  }
}

/** Локализованное имя счёта/субконто с фолбэком nameKz -> nameRu. */
export const pickLocalizedName = (
  obj: { nameRu: string; nameKz: string | null } | { kindNameRu: string; kindNameKz: string | null },
  language: string
): string => {
  if ('kindNameRu' in obj) {
    return language === 'kz' && obj.kindNameKz ? obj.kindNameKz : obj.kindNameRu
  }
  return language === 'kz' && obj.nameKz ? obj.nameKz : obj.nameRu
}

/** Удобный фолбэк displayName для карточки. */
export const accountDisplayName = (
  entry: AccountPlanEntryDto,
  language: string
): string => pickLocalizedName(entry, language) || entry.code
