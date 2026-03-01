export interface ModuleElement {
  code: string
  type: 'Document' | 'Dictionary' | 'Report'
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
