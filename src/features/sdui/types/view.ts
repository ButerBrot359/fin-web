import type { ActionType, EffectType, NodeType, PatchOp } from './node-types'

export interface ViewNode {
  id: string
  type: NodeType
  props?: Record<string, unknown>
  binding?: string
  value?: unknown
  children?: ViewNode[]
  actions?: ViewNodeAction[]
}

// Метаданные поведения действия (SCRUM-283): бэк описывает, что делать
// вокруг команды, чтобы фронт не анализировал её имя.
export interface ActionBehavior {
  // Перед отправкой команды слить несохранённые строки редактируемых ТЧ в state
  flushPendingTables?: boolean
  // После успешного ответа снять признак «есть изменения»
  resetsDirty?: boolean
  // После успеха закрыть вкладку/панель (навигация — только через effect navigate)
  closeAfter?: boolean
}

export interface ViewNodeAction {
  trigger: string
  actionId: string
  command?: string
  behavior?: ActionBehavior | null
}

export interface ViewAction {
  type: ActionType
  sourceNodeId?: string
  trigger?: string
  command?: string
  value?: unknown
  layoutCode?: string
  // Маркер полноты снимка строк ТЧ на table-level EVENT (спека reference-cell §2.2):
  // true = полный массив, бэк может делать full-replace (включая пустой [] = удалить все)
  fullSnapshot?: boolean
}

export interface ViewRequest {
  formSessionId?: string | null
  revision?: number | null
  layoutCode?: string | null
  route?: string
  action: ViewAction
  state?: Record<string, unknown>
  // Язык интерфейса формы; сервер читает только на OPEN (SCRUM-268)
  language?: string
}

export interface ViewResponse {
  formSessionId: string
  revision: number
  tree?: ViewNode
  state?: Record<string, unknown>
  patches?: ViewPatch[]
  statePatch?: Record<string, unknown>
  effects?: ViewEffect[]
  // Дескриптор «закрыть грязную вкладку» — приходит только на OPEN (SCRUM-283)
  onDirtyClose?: ViewNodeAction | null
}

export interface ViewPatch {
  op: PatchOp
  nodeId?: string
  binding?: string
  key?: string
  value?: unknown
  parentId?: string
  index?: number
  node?: ViewNode
  options?: unknown
}

export interface ViewEffect {
  type: EffectType
  route?: string
  node?: ViewNode
  id?: string
  level?: string
  message?: string
  url?: string
  sessionId?: string
  childRevision?: number
  childState?: Record<string, unknown>
  applyToParentSessionId?: string
  applyToParentTargetNodeId?: string
  applyToParentValue?: unknown
}

export interface NodeProps {
  node: ViewNode
}

export interface ConflictError {
  code: 'STALE_REVISION' | 'SESSION_NOT_FOUND'
  formSessionId?: string
  currentRevision?: number
  snapshot?: { state: Record<string, unknown> }
  reason?: string
}
