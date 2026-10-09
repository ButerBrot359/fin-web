import type { ApiResponse } from '@/shared/types/api.types'

export enum ModuleElementType {
  Document = 'Document',
  Dictionary = 'Dictionary',
  Report = 'Report',
  /** Отчёт нового контура ReportAlt (`/api/reportalt/*`) — страница `/modules/{pageCode}/reportalt/{code}`. */
  ReportAlt = 'ReportAlt',
  InformationRegister = 'InformationRegister',
  AccumulationRegister = 'AccumulationRegister',
  AccountingRegister = 'AccountingRegister',
  AccountPlan = 'AccountPlan',
  CalculationPlan = 'CalculationPlan',
  DataProcessor = 'DataProcessor',
  Analytics = 'Analytics',
}

export interface ModuleElement {
  code: string
  type: ModuleElementType
  domainKind: string | null
  skipDependsOn?: boolean
  nameRu: string
  nameKz: string
  /**
   * SCRUM-400 §6.1: исполняемый объект пункта (отчёт/обработка) — для прав
   * бэка; фронт пути строит по type/code, поля справочные.
   */
  executableObjectKind?: 'REPORT_ALT' | 'REPORT' | 'DATA_PROCESSOR' | null
  executableObjectCode?: string | null
  /**
   * SCRUM-400 §6.1: READY | UNAVAILABLE | NAV_SUPPRESSED (прежний ROLE_HIDDEN
   * переименован и больше не приходит). Фронт значение не использует.
   */
  availability?: string
  /**
   * Готовый маршрут вместо вычисляемого `/modules/{pageCode}/{type}/{code}`.
   *
   * Нужен собственным экранам, которых нет в SDUI-контуре, — журналу регистрации и снятию
   * блокировок по бездействию: у них нет ни типа метаданных, ни кода объекта, из которых
   * строится обычная ссылка. Поле необязательное: у остальных пунктов меню его нет, и путь
   * по-прежнему считается из типа и кода.
   */
  route?: string
}

export interface ModuleSection {
  nameRu: string
  nameKz: string
  elements: ModuleElement[]
}

export type ModuleColumn = ModuleSection[]

export type ModuleItems = ModuleColumn[]

export type ModuleResponseData = ApiResponse<{ items: ModuleItems }>
