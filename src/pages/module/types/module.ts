export enum ModuleElementType {
  Document = 'Document',
  Dictionary = 'Dictionary',
  Report = 'Report',
}

export interface ModuleElement {
  code: string
  type: ModuleElementType
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
