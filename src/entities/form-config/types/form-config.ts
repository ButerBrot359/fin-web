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

/**
 * Серверный фильтр ссылочного поля. Ключ в `fieldFilters` — путь поля:
 * для шапки = код поля (`MOL`), для строки ТЧ = `<КодТЧ><КодКолонки>`
 * (напр. `OsnovnyeSredstvaMOL`). `attributeEquals` уже содержит конкретные
 * значения (напр. id «Организации» документа) — их кладём в запрос пикера
 * как query-параметры `attributeCode=value`.
 */
export interface FieldFilter {
  domain?: string
  typeCode?: string
  attributeEquals?: Record<string, number | string>
}

/** Условие правила оформления: сравнение значения `attribute` строки с `value`. */
export interface AppearanceCondition {
  attribute: string
  operator: 'less' | 'greater' | 'equal'
  value: number | string
}

/** Правило: при выполнении `when` показать `text` цветом `textColor`. */
export interface AppearanceRule {
  when: AppearanceCondition
  text: string
  textColor?: string
}

/**
 * Условное оформление ячейки колонки ТЧ (доменное, не per-row): один набор
 * правил применяется ко всем строкам указанных `tableParts`, вычисление — по
 * значению строки. Приходит в `formConfig` (OPEN + события), как `fieldFilters`.
 */
export interface ConditionalAppearance {
  tableParts: string[]
  column: string
  rules: AppearanceRule[]
}

export interface FormConfig {
  name: string
  title: string
  layout: FormNode
  fieldFilters?: Record<string, FieldFilter>
  conditionalAppearance?: ConditionalAppearance[]
}
