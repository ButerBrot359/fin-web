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

export interface ViewNodeAction {
  trigger: string
  actionId: string
  command?: string
}

export interface ViewAction {
  type: ActionType
  sourceNodeId?: string
  trigger?: string
  command?: string
  value?: unknown
  layoutCode?: string
}

export interface ViewRequest {
  formSessionId?: string | null
  revision?: number | null
  layoutCode?: string | null
  route?: string
  action: ViewAction
  state?: Record<string, unknown>
}

export interface ViewResponse {
  formSessionId: string
  revision: number
  tree?: ViewNode
  state?: Record<string, unknown>
  patches?: ViewPatch[]
  statePatch?: Record<string, unknown>
  effects?: ViewEffect[]
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
  revision?: number
  state?: Record<string, unknown>
  parentSessionId?: string
  targetNodeId?: string
  value?: unknown
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
