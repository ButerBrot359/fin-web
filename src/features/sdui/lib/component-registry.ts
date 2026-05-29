import type { FC } from 'react'

import type { NodeProps } from '../types/view'

const registry: Record<string, FC<NodeProps>> = {}

export function getComponent(type: string): FC<NodeProps> | undefined {
  return registry[type]
}

export function registerComponent(type: string, component: FC<NodeProps>): void {
  registry[type] = component
}
