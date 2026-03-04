export type FieldType =
  | 'text'
  | 'number'
  | 'decimal'
  | 'select'
  | 'reference'
  | 'datetime'
  | 'date'
  | 'textarea'
  | 'checkbox'

export type LabelVariant = 'default' | 'link' | 'heading'

export interface VStackNode {
  type: 'VStack'
  children: FormNode[]
  gap?: number
  flex?: number
}

export interface HStackNode {
  type: 'HStack'
  children: FormNode[]
  gap?: number
  flex?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
}

export interface FieldNode {
  type: 'Field'
  code: string
  fieldType?: FieldType
  label?: string
  flex?: number
}

export interface SeparatorNode {
  type: 'Separator'
}

export interface LabelNode {
  type: 'Label'
  text?: string
  textKey?: string
  variant?: LabelVariant
}

export interface TabPane {
  key: string
  label: string
  children: FormNode[]
}

export interface TabsNode {
  type: 'Tabs'
  panes: TabPane[]
}

export type FormNode =
  | VStackNode
  | HStackNode
  | FieldNode
  | SeparatorNode
  | LabelNode
  | TabsNode

export interface FormConfig {
  name: string
  title: string
  layout: FormNode
}
