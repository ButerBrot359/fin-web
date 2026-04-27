import type { ApiResponse } from '@/shared/types/api.types'

export enum ModuleElementType {
  Document = 'Document',
  Dictionary = 'Dictionary',
  Report = 'Report',
  InformationRegister = 'InformationRegister',
}

export interface ModuleElement {
  code: string
  type: ModuleElementType
  domainKind: string | null
  skipDependsOn?: boolean
  nameRu: string
  nameKz: string
}

export interface ModuleSection {
  nameRu: string
  nameKz: string
  elements: ModuleElement[]
}

export type ModuleColumn = ModuleSection[]

export type ModuleItems = ModuleColumn[]

export type ModuleResponseData = ApiResponse<{ items: ModuleItems }>
