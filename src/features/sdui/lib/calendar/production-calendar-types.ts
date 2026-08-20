// SCRUM-277: контракт v2 узла CALENDAR в режиме производственного календаря
// (mode=dayKind). Ключи props — generic-набор (mode/year/days/dayKinds),
// транслит-дубли (rezhim/god/dni/vidyDney) фронт не читает — см. calendar-types.ts.
// Поля без дублей (draftId, allowedOperations, transfers и пр.) приходят
// в единственном написании из бэк-спеки.

import type {
  CalendarDayKind,
  CalendarDayKindDay,
  CalendarNodeProps,
} from './calendar-types'

export const PRODUCTION_CALENDAR_CONTRACT_VERSION = 2

/** Виды дня из бэк-спеки §4.1. Провод шире типа: неизвестный код не ошибка. */
export type ProductionCalendarDayKindCode =
  | 'Rabochiy'
  | 'Subbota'
  | 'Voskresene'
  | 'DopolnitelnyyVykhodnoy'
  | 'Predprazdnichnyy'
  | 'Prazdnik'
  | 'Nerabochiy'

export type ProductionCalendarOperation =
  | 'VIEW'
  | 'EDIT_EXISTING'
  | 'CREATE_NEW'
  | 'CHANGE_DAY'
  | 'TRANSFER_DAY'
  | 'FILL_YEAR'
  | 'SAVE_YEAR'
  | 'OPEN_CLASSIFIER_PICKER'
  | 'APPLY_CLASSIFIER_SELECTION'
  | 'UPDATE_CLASSIFIER'
  | 'PRINT'
  | 'EXECUTE_CORRECTION'

export type ProductionCalendarCommandOutcome =
  | 'YEAR_SWITCHED'
  | 'CURRENT_YEAR'
  | 'SAVE_DISCARD_CANCEL_REQUIRED'
  | 'DAYS_STAGED'
  | 'TRANSFER_STAGED'
  | 'DEFAULT_FILLED'
  | 'HEADER_STAGED'
  | 'BASE_SELECTED'
  | 'BASE_ENABLED'
  | 'BASE_CLEARED'
  | 'BASE_OPTIONS_LOADED'
  | 'OPTIONS_LOADED'
  | 'DRAFT_DISCARDED'
  | 'PRINT_READY'
  | 'PRINT_SAVE_REQUIRED'

/** Строка списка переносов. presentation готовит бэк — фронт текст не строит. */
export interface ProductionCalendarTransferRow {
  sourceDate: string
  destinationDate: string
  sourceKindCode: string | null
  presentation: string
}

export interface ProductionCalendarBaseCandidate {
  id: number
  code?: string | null
  nameRu?: string | null
  nameKz?: string | null
}

/**
 * Props узла CALENDAR contract v2 поверх generic-набора. Единственный оракул
 * доступности спец-действий — allowedOperations; фронт не выводит права из
 * ролей, кодов `01`/`02` или наличия данных.
 */
export interface ProductionCalendarNodeProps extends CalendarNodeProps {
  productionCalendarContractVersion?: number

  draftId?: string | null
  draftVersion?: number | null
  modified?: boolean
  coverage?: 'FULL' | 'PARTIAL'
  allowedOperations?: ProductionCalendarOperation[]

  days?: CalendarDayKindDay[]
  transfers?: ProductionCalendarTransferRow[]

  baseVisible?: boolean
  hasBaseCalendar?: boolean
  baseCalendarEntryId?: number | null
  baseCandidates?: ProductionCalendarBaseCandidate[]

  lastCommand?: string | null
  commandOutcome?: ProductionCalendarCommandOutcome | null
  commandResult?: unknown
}

/** Пейлоад draft-команд (§6.1): identity + год, поверх — поля конкретной команды. */
export interface ProductionCalendarDraftEnvelope {
  draftId: string
  expectedDraftVersion: number
  calendarYear: number
}

export type { CalendarDayKind, CalendarDayKindDay }
